import * as sst from '@serverless-stack/resources';
import { Template } from 'aws-cdk-lib/assertions';

import CoreStack from '../stacks/CoreStack';

test('Core Stack', () => {
  const app = new sst.App();
  // WHEN
  const stack = new CoreStack(app, 'test-stack');
  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Lambda::Function', 18);
});
