import * as cdk from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  createCNAME,
  createDistribution,
  createHostedZone,
  createZoneCertificate,
} from './network';
import { createPermissions } from './permissions';
import { createBuckets } from './storage';

export class MonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create Hosted Zone
     */
    const { hostedZone } = createHostedZone(this);

    /**
     * Create Certificate
     */
    const { certificate } = createZoneCertificate(this);

    /**
     * Create Buckets
     */
    const { frontendBucket, assetsBucket } = createBuckets(this);

    /**
     * Creates the permissions for the GitHub Actions autobuild.
     */
    const { githubActionsUser } = createPermissions(this);

    /**
     * Storage (S3)
     */
    frontendBucket.grantReadWrite(githubActionsUser);

    /**
     * Log Group
     */
    new LogGroup(this, `${this.stackName}ServiceLogGroup`, {
      logGroupName: '/services/monitor',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Creates the distribution for the frontend.
     */
    const { distribution } = createDistribution(
      this,
      frontendBucket,
      certificate,
    );
    distribution.grantCreateInvalidation(githubActionsUser);

    /**
     * Creates the CNAME for the distribution.
     */
    createCNAME(this, hostedZone, distribution);
  }
}
