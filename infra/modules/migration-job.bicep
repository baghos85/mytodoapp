@description('Job name.')
param name string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('Resource id of the Container Apps environment.')
param environmentId string

@description('Full image reference, e.g. <registry>/mytodoapp-migrate:<sha>.')
param image string

@description('Registry login server; the image is pulled with the job identity (AcrPull).')
param registryServer string

@description('Resource id of the user-assigned identity of the job.')
param identityId string

@description('Environment variables for the container.')
param env array

// Manual trigger, started by deploy.yml (step 5) and awaited before the apps switch to the new image (ADR-018).
resource job 'Microsoft.App/jobs@2026-01-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: env
        }
      ]
    }
  }
}

output name string = job.name
