import { Application } from "typedoc"
import { NextraTheme } from './theme'
import { initMarkdown } from './markdown'

export function load(app: Application) {
    initMarkdown().then(() => {
        app.renderer.defineTheme('nextra', NextraTheme)
    })
}