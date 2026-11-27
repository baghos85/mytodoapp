@description('Environment name.')
param name string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('Name of the Log Analytics workspace (same resource group) that receives app logs.')
param logAnalyticsWorkspaceName string

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-07-01' existing = {
  name: logAnalyticsWorkspaceName
}

// Consumption-only environment (no workload profiles), no VNet.
resource environment 'Microsoft.App/managedEnvironments@2026-01-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    zoneRedundant: false
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

output name string = environment.name
output defaultDomain string = environment.properties.defaultDomain
