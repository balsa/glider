# @balsahq/glider-aws

## 0.4.1

## 0.4.0

### Minor Changes

- cb0f702: Emit ESM for AWS Lambda

### Patch Changes

- ca82f1e: Use ESM everywhere
- 0952f1b: Drop remaining use of AWS SDK v2

## 0.3.0

### Minor Changes

- 58f9ab1: Introduced context object to `Destination.write` method signature, and moved Job ID from first positional argument to `jobId` property of the context (breaking change!)

## 0.2.10

### Patch Changes

- Expose Worker lambdas using named keys instead of an array
- Expose API route lambdas using objects that also include the HTTP method and path

## 0.2.9

### Patch Changes

- 0400af4: Expose access to AWS Lambdas created by Glider

## 0.2.8

### Patch Changes

- d0b1e1d: Expose `ServiceProps` type

## 0.2.7

### Patch Changes

- 4330eff: Allow secrets to be passed to job runners

## 0.2.6

### Patch Changes

- dfaf722: Nest all worker configuration under `worker` prop
- 7dff87d: Allow variables to be added to the runner environment

## 0.2.5

### Patch Changes

- 10ec255: Expose `cluster` property of `worker`'

## 0.2.4

### Patch Changes

- Include updated distributables

## 0.2.3

### Patch Changes

- e91128b: Make `Service` construct-scoped

## 0.2.2

### Patch Changes

- 774ca91: Add `grantApiAccess` method, which grants the passed principal access to the Glider API
- 9410acf: Enable DynamoDB point-in-time recovery by default, and make it configurable
- 771c56c: Make worker VPC configurable

## 0.2.1

## 0.2.0

### Minor Changes

- b2a586c: Support customizable worker logging configuration
- b2a586c: Load runner image from Docker Hub
- b2a586c: Migrate from Serverless Stack to raw CDK

### Patch Changes

- 255da59: Export `GliderStack` and `Service`
- 8267fe6: Move CDK to `peerDependencies`
- 2c739d5: Expose service properties on `GliderStack`
