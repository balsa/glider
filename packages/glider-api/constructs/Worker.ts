import * as sst from '@serverless-stack/resources';
import {
  Duration,
  aws_ecs as ecs,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface WorkerProps {
  timeout: Duration;
}

const defaultProps: WorkerProps = {
  timeout: Duration.hours(24),
};

export class Worker extends Construct {
  props: WorkerProps;

  constructor(scope: Construct, id: string, props?: WorkerProps) {
    super(scope, id);

    this.props = {
      ...defaultProps,
      ...props,
    };

    const beforeSyncFn = new sst.Function(this, 'BeforeSyncFn', {
      handler: '../src/beforeSync',
    });

    const afterSyncFn = new sst.Function(this, 'AfterSyncFn', {
      handler: '../src/afterSync',
    });

    const afterSleepFn = new sst.Function(this, 'AfterSleepFn', {
      handler: '../src/afterSleep',
    });

    const invokeSelfFn = new sst.Function(this, 'InvokeSelfFn', {
      handler: '../src/invokeSelf',
    });

    const beforeSync = new tasks.LambdaInvoke(this, 'Before Sync', {
      lambdaFunction: beforeSyncFn,
    });

    const afterSync = new tasks.LambdaInvoke(this, 'After Sync', {
      lambdaFunction: afterSyncFn,
    });

    const afterSleep = new tasks.LambdaInvoke(this, 'After Sleep', {
      lambdaFunction: afterSleepFn,
    });

    const waitX = new sfn.Wait(this, 'Wait X Seconds', {
      time: sfn.WaitTime.secondsPath('$.waitSeconds'),
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      containerInsights: true,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'TaskDefinition',
      {
        runtimePlatform: {
          // Use Graviton2 architecture
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      }
    );

    const containerDefinition = taskDefinition.addContainer('Worker', {
      image: ecs.ContainerImage.fromAsset('..'),
    });

    const syncTask = new tasks.EcsRunTask(this, 'Sync', {
      cluster,
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      taskDefinition,
      containerOverrides: [
        {
          containerDefinition,
          environment: [
            {
              name: 'JOB_ID',
              value: sfn.JsonPath.stringAt('$.jobId'),
            },
          ],
        },
      ],
      outputPath: '$.Payload',
    });

    // Step Functions has built-in support for starting execution of Step
    // Functions, but we can't use it because it from here, since it would
    // create a circular reference. (We don't know our Step Function's ARN until
    // after it's created.) We work around that by invoking a Lambda that uses
    // the Step Functions API.
    const invokeSelf = new tasks.LambdaInvoke(this, 'Invoke Self', {
      lambdaFunction: invokeSelfFn,
    });

    const done = new sfn.Succeed(this, 'Done');
    const cleanup = afterSync
      .next(waitX)
      .next(afterSleep)
      .next(
        new sfn.Choice(this, 'Check Connection Status')
          // If the schedule was changed, we might have woken up too early,
          // and should sleep.
          .when(sfn.Condition.stringEquals('$.status', 'IDLE'), waitX)
          // If a job is running for this connection, we should terminate.
          // (Otherwise we'll have two loops for this connection.) Another job
          // may have kicked off because someone manually triggered it, or if
          // the schedule was shortened while we were sleeping.
          .when(sfn.Condition.stringEquals('$.status', 'RUNNING'), done)
          .otherwise(invokeSelf)
      );

    const definition = beforeSync.next(
      new sfn.Choice(this, 'Got Job ID?')
        // If we got a Job ID, that means we have a ticket to sync, and should
        // do so. If we weren't issued one, it means another job is running, so
        // we can safely terminate.
        .when(sfn.Condition.isPresent('$.jobId'), syncTask.next(cleanup))
        .otherwise(done)
    );

    new sfn.StateMachine(scope, 'StateMachine', {
      definition,
      timeout: this.props.timeout,
    });
  }
}
