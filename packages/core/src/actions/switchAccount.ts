import type { Address } from 'viem'

import { type Config, type Connector } from '../createConfig.js'
import { ConnectorNotConnectedError } from '../errors/config.js'

export type SwitchAccountParameters = {
  connector: Connector
}

export type SwitchAccountReturnType<config extends Config = Config> = {
  accounts: readonly [Address, ...Address[]]
  chainId:
    | config['chains'][number]['id']
    | (number extends config['chains'][number]['id'] ? number : number & {})
}

export type SwitchAccountError = ConnectorNotConnectedError | Error

/** https://alpha.wagmi.sh/core/api/actions/switchAccount */
export async function switchAccount<config extends Config>(
  config: config,
  parameters: SwitchAccountParameters,
): Promise<SwitchAccountReturnType<config>> {
  const { connector } = parameters
  const connection = config.state.connections.get(connector.uid)
  if (!connection) throw new ConnectorNotConnectedError()

  await config.storage?.setItem('recentConnectorId', connector.id)
  config.setState((x) => ({
    ...x,
    current: connector.uid,
  }))
  return {
    accounts: connection.accounts,
    chainId: connection.chainId,
  }
}
