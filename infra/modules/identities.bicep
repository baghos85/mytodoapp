@description('Names of the user-assigned managed identities to create (one per app).')
param names string[]

@description('Azure region.')
param location string

@description('Tags for every resource.')
param tags object

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = [
  for name in names: {
    name: name
    location: location
    tags: tags
  }
]

output names string[] = [for (name, i) in names: identity[i].name]
