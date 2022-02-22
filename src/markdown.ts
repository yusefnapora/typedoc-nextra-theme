import * as path from 'path'
import { ContainerReflection, PageEvent } from 'typedoc';


// this is a silly workaround for a silly typescript + ESM issue.
// see: https://github.com/microsoft/TypeScript/issues/43329#issuecomment-1008361973
function hackImport<T>(module: string): Promise<T> {
    return Function(`return import("${module}")`)() as Promise<T>
}

// unified & friends are ESM modules, but typedoc plugins need to be commonjs.
// this is currently the least hacky way I can think of to make this work
let unified
let remarkParse
let remarkStringify
let visit
// let visitParents
export async function initMarkdown() {
    const unifiedModule = await hackImport<typeof import('unified')>('unified')
    unified = unifiedModule.unified

    const visitModule = await hackImport<typeof import('unist-util-visit')>('unist-util-visit')
    visit = visitModule.visit

    // const visitParentsModule = await hackImport<typeof import('unist-util-visit-parents')>('unist-util-visit-parents')
    // const visitParents = visitParentsModule.visitParents

    const parseModule = await hackImport<typeof import('remark-parse')>('remark-parse')
    remarkParse = parseModule.default

    const stringifyModule = await hackImport<typeof import('remark-stringify')>('remark-stringify')
    remarkStringify = stringifyModule.default
}

// remark plugin to transform links to `.md` files to `/`, so they
// match nextra routes
const remarkFixMarkdownLinks = ({ currentFilename }) => tree => {
    visit(tree, 'link', node => {
        if (typeof node.url !== 'string') {
            return
        }
        // the typedoc markdown plugin will emit relative links by default,
        // so ignore any absolute links
        if (node.url.startsWith('http')) {
            return
        }
        if (node.url.startsWith(currentFilename)) {
            node.url = node.url.replace(currentFilename, '')
            return
        }
        node.url = node.url.replaceAll(/\.md?/g, '/')
    })
}

// const remarkEscapeSpecialChars = () => tree => {
//     visit(tree, 'text', (node) => {
//         node.value = escapeMDXSpecialChars(node.value)
//     })
// }

// function escapeMDXSpecialChars(str) {
//     return str
//         // see https://github.com/tgreyuk/typedoc-plugin-markdown/issues/252
//         .replaceAll(/(?<!\\)<(?!\/?a)/g, '\\<')
//         .replaceAll(/(?<!\\)>(?!\/?a)/g, '\\>')

//         // escape '{' and '}' sequences to avoid MDX treating them as a JS interpolation
//         .replaceAll(/<(?<!\\){/g, '<\\{')
//         .replaceAll(/(?<!\\)}>/g, '\\}>')
// }

function fixMarkdownContent(fileBasename, content) {
    const processor = unified()
        .use(remarkParse)
        .use(remarkFixMarkdownLinks, { currentFilename: fileBasename })
        .use(remarkStringify as any, {
            unsafe: [
                {character: '{', inConstruct: 'phrasing' },
                {character: '}', inConstruct: 'phrasing' },
                {character: '<', inConstruct: 'phrasing' },
                {character: '>', inConstruct: 'phrasing' },
            ]
        })
    const processed = processor.processSync(content)
    return processed.value
      .replaceAll('TokenType<T>', 'TokenType\\<T\\>') // grrr...
}

export function fixPageMarkdown(page: PageEvent<ContainerReflection>) {
    if (!page.contents) {
        return
    }

    const filename = path.basename(page.url)
    const fixed = fixMarkdownContent(filename, page.contents)
    page.contents = fixed
}