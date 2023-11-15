import { pascalCase } from 'change-case'
import ts, { factory } from 'typescript'

import { type Plugin } from '../../config.js'
import { type Evaluate, type RequiredBy } from '../../types.js'
import {
  abiIdentifier,
  argsIdentifier,
  configIdentifier,
  functionNameIdentifier,
  pureViewUnionType,
  selectDataIndentifier,
  useReadContractParametersTypeAliasDeclaration,
  useReadContractParametersTypeAliasDeclarationIdentifier,
  viemAbiImportSpecifier,
  viemContractFunctionArgsIdentifier,
  viemContractFunctionArgsImportSpecifier,
  viemContractFunctionNameIdentifier,
  viemContractFunctionNameImportSpecifier,
  wagmiConfigIdentifier,
  wagmiConfigImportSpecifier,
  wagmiReadContractDataIdentifier,
  wagmiReadContractDataImportSpecifier,
  wagmiResolvedRegisterIdentifier,
  wagmiResolvedRegisterImportSpecifier,
} from './declarations.js'

export type ReactConfig = { foo?: string | undefined }

type ReactResult = Evaluate<RequiredBy<Plugin, 'run'>>

// Useful when building this plugin:
// https://ts-ast-viewer.com

export function react(_config: ReactConfig = {}): ReactResult {
  return {
    name: 'React',
    async run({ contracts }) {
      const nodes = []
      const importsMap: Map<string, Set<ts.ImportSpecifier>> = new Map()
      const typeDeclarationsMap: Map<string, ts.TypeAliasDeclaration> =
        new Map()

      for (const contract of contracts) {
        let hasReadFunction = false
        let hasWriteFunction = false
        let hasEvent = false
        for (const component of contract.abi) {
          if (component.type === 'function')
            if (
              component.stateMutability === 'view' ||
              component.stateMutability === 'pure'
            )
              hasReadFunction = true
            else hasWriteFunction = true
          else if (component.type === 'event') hasEvent = true
          // Exit early if all flags are `true`
          if (hasReadFunction && hasWriteFunction && hasEvent) break
        }

        if (hasReadFunction || hasWriteFunction) {
          addImports(importsMap, 'wagmi', [
            wagmiConfigImportSpecifier,
            wagmiResolvedRegisterImportSpecifier,
          ])

          addImports(importsMap, 'viem', [
            viemAbiImportSpecifier,
            viemContractFunctionNameImportSpecifier,
            viemContractFunctionArgsImportSpecifier,
          ])
        }

        if (hasReadFunction) {
          const parametersIdentifier = ts.factory.createIdentifier(
            'UseReadContractParameters',
          )
          const parametersImportSpecifier = ts.factory.createImportSpecifier(
            true,
            undefined,
            parametersIdentifier,
          )
          const returnTypeIdentifier = ts.factory.createIdentifier(
            'UseReadContractReturnType',
          )
          const returnTypeImportSpecifier = ts.factory.createImportSpecifier(
            true,
            undefined,
            returnTypeIdentifier,
          )

          addImports(importsMap, 'wagmi', [
            parametersImportSpecifier,
            returnTypeImportSpecifier,
          ])

          typeDeclarationsMap.set(
            useReadContractParametersTypeAliasDeclaration.name.escapedText!,
            useReadContractParametersTypeAliasDeclaration,
          )

          addImports(importsMap, 'wagmi/query', [
            wagmiReadContractDataImportSpecifier,
          ])

          const indentifier = factory.createIdentifier(
            `useRead${pascalCase(contract.name)}`,
          )
          const hook = factory.createFunctionDeclaration(
            [factory.createToken(ts.SyntaxKind.ExportKeyword)],
            undefined,
            indentifier,
            [
              factory.createTypeParameterDeclaration(
                [factory.createToken(ts.SyntaxKind.ConstKeyword)],
                abiIdentifier,
                factory.createTypeQueryNode(
                  factory.createIdentifier(contract.meta.abiName),
                  undefined,
                ),
                undefined,
              ),
              factory.createTypeParameterDeclaration(
                undefined,
                functionNameIdentifier,
                factory.createTypeReferenceNode(
                  viemContractFunctionNameIdentifier,
                  [
                    factory.createTypeReferenceNode(abiIdentifier, undefined),
                    pureViewUnionType,
                  ],
                ),
                undefined,
              ),
              factory.createTypeParameterDeclaration(
                [factory.createToken(ts.SyntaxKind.ConstKeyword)],
                argsIdentifier,
                factory.createTypeReferenceNode(
                  viemContractFunctionArgsIdentifier,
                  [
                    factory.createTypeReferenceNode(abiIdentifier, undefined),
                    pureViewUnionType,
                    factory.createTypeReferenceNode(
                      functionNameIdentifier,
                      undefined,
                    ),
                  ],
                ),
                undefined,
              ),
              factory.createTypeParameterDeclaration(
                undefined,
                configIdentifier,
                factory.createTypeReferenceNode(
                  wagmiConfigIdentifier,
                  undefined,
                ),
                factory.createIndexedAccessTypeNode(
                  factory.createTypeReferenceNode(
                    wagmiResolvedRegisterIdentifier,
                    undefined,
                  ),
                  factory.createLiteralTypeNode(
                    factory.createStringLiteral('config'),
                  ),
                ),
              ),
              factory.createTypeParameterDeclaration(
                undefined,
                selectDataIndentifier,
                undefined,
                factory.createTypeReferenceNode(
                  wagmiReadContractDataIdentifier,
                  [
                    factory.createTypeReferenceNode(abiIdentifier, undefined),
                    factory.createTypeReferenceNode(
                      functionNameIdentifier,
                      undefined,
                    ),
                    factory.createTypeReferenceNode(argsIdentifier, undefined),
                  ],
                ),
              ),
            ],
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier('parameters'),
                factory.createToken(ts.SyntaxKind.QuestionToken),
                factory.createTypeReferenceNode(
                  useReadContractParametersTypeAliasDeclarationIdentifier,
                  [
                    factory.createTypeReferenceNode(abiIdentifier, undefined),
                    factory.createTypeReferenceNode(
                      functionNameIdentifier,
                      undefined,
                    ),
                    factory.createTypeReferenceNode(argsIdentifier, undefined),
                    factory.createTypeReferenceNode(
                      configIdentifier,
                      undefined,
                    ),
                  ],
                ),
                undefined,
              ),
            ],
            undefined,
            factory.createBlock(
              [factory.createReturnStatement(undefined)],
              true,
            ),
          )
          nodes.push(hook)
        }

        if (hasWriteFunction) {
          const indentifier = factory.createIdentifier(
            `useWrite${pascalCase(contract.name)}`,
          )
          const hook = factory.createFunctionDeclaration(
            [factory.createToken(ts.SyntaxKind.ExportKeyword)],
            undefined,
            indentifier,
            undefined,
            [],
            undefined,
            factory.createBlock(
              [factory.createReturnStatement(undefined)],
              true,
            ),
          )
          nodes.push(hook)
        }
      }

      // Add in type declarations to nodes
      nodes.unshift(...typeDeclarationsMap.values())

      // Render out nodes to content
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
      const sourceFile = ts.createSourceFile('', '', ts.ScriptTarget.Latest)

      let imports = ''
      for (const [name, namedImports] of importsMap.entries()) {
        const node = ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([...namedImports.values()]),
          ),
          ts.factory.createStringLiteral(name),
          undefined,
        )

        imports += printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
        imports += '\n'
      }

      let content = ''
      for (const node of nodes) {
        content += printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
        content += '\n\n'
      }

      console.log(imports)
      console.log(content)

      return { imports, content }
    },
  }
}

function addImports(
  importsMap: Map<string, Set<ts.ImportSpecifier>>,
  name: string,
  imports: ts.ImportSpecifier[],
) {
  if (importsMap.has(name)) {
    const current = importsMap.get(name)!
    for (const i of imports) current.add(i)
    importsMap.set(name, current)
  } else
    importsMap.set(
      name,
      new Set([
        wagmiConfigImportSpecifier,
        wagmiResolvedRegisterImportSpecifier,
      ]),
    )
}
