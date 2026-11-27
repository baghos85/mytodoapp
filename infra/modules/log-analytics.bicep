@description('Workspace name.')
param name string

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

@description('Log retention in days (privacy notice: 30 days).')
param retentionInDays int = 30

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

output name string = workspace.name
output id string = workspace.id
