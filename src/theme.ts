import * as fs from 'fs';
import * as path from 'path';


import {
  PageEvent,
  RendererEvent,
  Renderer,
  ContainerReflection,
  ProjectReflection,
  UrlMapping,
  DeclarationReflection,
  Reflection,
  ReflectionKind,
} from 'typedoc';
import { MarkdownTheme } from 'typedoc-plugin-markdown';
import { getKindPlural } from 'typedoc-plugin-markdown/dist/groups';
import { NavigationItem } from 'typedoc-plugin-markdown/dist/navigation-item';

import { fixPageMarkdown } from './markdown';

export class NextraTheme extends MarkdownTheme {
    private titleMap: Map<string, string> = new Map()

    constructor(renderer: Renderer) {
        super(renderer)
        this.hideBreadcrumbs = true
        this.filenameSeparator = '-'

        this.listenTo(this.owner, {
            [PageEvent.END]: this.onNextraPageEnd,
            [RendererEvent.END]: this.onNextraRendererEnd,
        })
    }

    private onNextraPageEnd(page: PageEvent<ContainerReflection>) {
        this.titleMap.set(page.url, this.getTitle(page))
        fixPageMarkdown(page)
    }

    toUrl(mapping: any, reflection: DeclarationReflection) {
        return mapping.directory + '/' + this.getUrl(reflection) + '.md';
    }

    private onNextraRendererEnd(renderer: RendererEvent) {
        const theme = this.application.renderer.theme as MarkdownTheme
        const navigation = theme.getNavigation(renderer.project)

        if (!navigation.children || navigation.children.length === 0) {
            return
        }
        navigation.children
          .filter((navItem) => navItem.isLabel)
          .forEach((navItem) => {
              const mapping = theme.mappings.find((mapping) =>
                mapping.kind.some(
                    (kind: ReflectionKind) => getKindPlural(kind) === navItem.title
                ))
                if (!mapping) {
                    return
                }
                const meta = this.makeMetaJson(navItem, mapping.directory)
                const outFile = path.join(renderer.outputDirectory, mapping.directory, 'meta.json')
                fs.writeFileSync(outFile, JSON.stringify(meta, null, 2), { encoding: 'utf-8' })
          })
    }

    private makeMetaJson(navItem: NavigationItem, dir: string): object {
        const meta = {}
        console.log('nav item url', navItem.url)
        console.log('dir', dir)
        for (const child of navItem.children || []) {
            const key = child.url.replace(dir + '/', '').replace(/\.mdx?$/, '')
            meta[key] = this.titleMap.get(child.url)
            console.log(`mapping ${key} to ${meta[key]}`)
        }
        return meta
    }

    // copied from the base theme because `child instanceof DeclarationReflection` was always returning false,
    // despite all children being of type DeclarationReflection.
    getUrls(project: ProjectReflection) {
        const urls: UrlMapping[] = [];
        const noReadmeFile = this.readme.endsWith('none');
        if (noReadmeFile) {
          project.url = this.entryDocument;
          urls.push(
            new UrlMapping(
              this.entryDocument,
              project,
              this.getReflectionTemplate(),
            ),
          );
        } else {
          project.url = this.globalsFile;
          urls.push(
            new UrlMapping(this.globalsFile, project, this.getReflectionTemplate()),
          );
          urls.push(
            new UrlMapping(this.entryDocument, project, this.getIndexTemplate()),
          );
        }
        project.children?.forEach((child: Reflection) => {
            this.buildUrls(child as DeclarationReflection, urls);
        });
        return urls;
      }


    getTitle(page: PageEvent<ContainerReflection>) {
        return page.model.name
    }
}

