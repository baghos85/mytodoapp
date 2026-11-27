@description('Container app name.')
param name string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('Resource id of the Container Apps environment.')
param environmentId string

@description('Full image reference, e.g. <registry>/mytodoapp-api:<sha>.')
param image string

@description('Registry login server; images are pulled with the app identity (AcrPull).')
param registryServer string

@description('Resource id of the user-assigned identity of this app.')
param identityId string

@description('true = internet-facing ingress; false = reachable only inside the environment.')
param externalIngress bool

@description('Path for the liveness, readiness and startup probes.')
param probePath string

@description('Optional Host header for the probes (needed when the app filters on AllowedHosts).')
param probeHost string = ''

@description('Environment variables for the container.')
param env array = []

var targetPort = 8080
var probeHeaders = empty(probeHost) ? [] : [{ name: 'Host', value: probeHost }]
var httpGet = {
  path: probePath
  port: targetPort
  scheme: 'HTTP'
  httpHeaders: probeHeaders
}

resource app 'Microsoft.App/containerApps@2026-01-01' = {
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
      activeRevisionsMode: 'Single'
      ingress: {
        external: externalIngress
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false // HTTPS only; HTTP is redirected
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
          name: 'app'
          image: image
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: env
          probes: [
            {
              type: 'Startup'
              httpGet: httpGet
              periodSeconds: 3
              failureThreshold: 20
            }
            {
              type: 'Liveness'
              httpGet: httpGet
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: httpGet
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output name string = app.name
output fqdn string = app.properties.configuration.ingress.fqdn
