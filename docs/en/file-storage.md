# Configure file relay storage

[简体中文](../zh-CN/file-storage.md) · [Skills guide](skills.md)

Configure storage only when taking personal Skills to remote workers. Local work and the public synthetic sample work immediately. Setup happens once on the DSH Host; Workers need no storage account or direct connection to the Host.

![S3 setup in native DSH (Chinese UI)](../../packages/dsh-plugin/design/storage-onboarding.zh-CN.png)

## The interface guides you through setup

When a personal remote Skill task has no storage configuration, it pauses at “Needs preparation” before starting an Agent. Open **Pamiya → Activity → task → Configure file storage**:

1. **Prepare storage** explains the required details. Continue with an existing bucket, prepare one below, or ask your administrator.
2. **Connect and test** collects the details. **Test and save** uploads a verification file, downloads it using a signed URL, checks its content and cleans up the test object. Failure retains the form and the previous valid configuration.
3. **Ready to use** offers **Return and continue the task**, retaining the original task, worker and Skill version.

You can also configure it ahead of time under **Pamiya → Connection → File transfer**. Enter secrets in the password field, never in conversation.

## Details to prepare

Obtain these from your existing S3-compatible service console:

| Field | Value |
|---|---|
| HTTPS endpoint | The S3 API endpoint, such as `https://s3.example.com`, rather than a console homepage or file sharing link |
| Bucket | An existing private bucket name, without `s3://` or a directory suffix |
| Region | The signing region specified by the service; `us-east-1` is only the initial value |
| Access Key ID / Secret Access Key | Dedicated credentials for this bucket, saved in the DSH credential service |
| Path-style bucket URL | An advanced option: choose according to the service’s support for `endpoint/bucket/key` versus `bucket.endpoint/key` |

Without existing storage, create a bucket and dedicated key in your S3-compatible service. The plugin does not open cloud accounts, create paid resources or allocate accounts to Workers. Keep the bucket private; signed URLs allow downloads of specific objects for a limited time. [Signed URLs explained](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html).

## Permissions and cleanup

Pamiya writes only under the `pamiya/` prefix. Services supporting AWS IAM policies can use this object-access template with `YOUR_BUCKET` replaced. For other services, grant equivalent permissions in their console. This template covers application APIs, not cloud-console browsing. [S3 permission reference](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-policies-s3.html).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/pamiya/*"
    }
  ]
}
```

Configure an appropriate lifecycle for `pamiya/` objects, such as 7 days. Worker-local version caches are unaffected; missing versions can be uploaded again from pinned Host snapshots. Avoid deleting objects immediately during active downloads. Storage, requests and transfer may incur fees under your service’s pricing.

## Troubleshooting

| Symptom | Action |
|---|---|
| Hostname / TLS error | Check the API endpoint and certificate. Both Host and Worker need HTTPS outbound access; do not use an endpoint reachable only from the Host |
| Access denied / invalid key | Check the dedicated credentials and read/write permissions for `pamiya/` |
| Bucket not found | Create it first and verify its name and region |
| Signature mismatch / redirect | Check the region, endpoint, addressing style and machine clock; use the service’s direct API endpoint |
| Host passes but Worker cannot download | The Worker may be on another network. Check its outbound policy and DNS; neither end needs to reach the other, but both must reach storage |

The test verifies connectivity, object access and signed downloading; it does not establish compatibility with every region, proxy or third-party implementation. Real Linux synthetic validation currently uses public HTTPS test files. Automated private-storage adapter checks and deployed-bucket verification are distinguished in the [verification record](dsh-verification.md).
