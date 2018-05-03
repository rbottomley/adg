const markdownIt = require('markdown-it')
const requireNew = require('require-new')

const plugins = {
  iterator: require('markdown-it-for-inline'),
  regexp: require('markdown-it-regexp'),
  abbr: require('markdown-it-abbr'),
  attrs: require('markdown-it-attrs'),
  deflist: require('markdown-it-deflist'),
  kbd: require('markdown-it-kbd'),
  samp: require('markdown-it-samp'),
  responsive: require('@gerhobbelt/markdown-it-responsive')
}

module.exports = rootDir => filePath => {
  const markdown = markdownIt({
    html: true,
    linkify: true,
    typography: true
  })
  const examples = requireNew('./examples')

  return (
    markdown
      .use(plugins.abbr)
      .use(plugins.attrs)
      .use(plugins.deflist)
      .use(plugins.kbd)
      .use(plugins.samp)
      .use(plugins.responsive, {
        // TODO: Specify proper sizes
        responsive: {
          srcset: {
            '*': [
              {
                width: 320,
                rename: {
                  suffix: '-small'
                }
              },
              {
                width: 640,
                rename: {
                  suffix: '-medium'
                }
              }
            ]
          },
          sizes: {
            '*': '(min-width: 36em) 33.3vw, 100vw'
          }
        }
      })
      .use(plugins.iterator, 'add_link_title', 'link_open', function (
        tokens,
        idx
      ) {
        const title = tokens[idx].attrGet('title')

        if (title) {
          return
        }

        const href = tokens[idx].attrGet('href')
        const metaTitle = examples.getTitle(href)

        if (!metaTitle) {
          return
        }

        tokens[idx].attrSet('title', metaTitle)
      })
      // .use(() => {
      //   // Currently unused: Increase heading levels by 1
      //   markdown.core.ruler.push('increase_heading_level', state => {
      //     state.tokens.forEach(token => {
      //       if (['heading_open', 'heading_close'].includes(token.type)) {
      //         token.tag = token.tag.replace(
      //           /[0-9]+/,
      //           match => parseInt(match, 10) + 1
      //         )
      //       }
      //     })
      //   })
      // })
      .use(() => {
        // Add links to codepen and code blocks to example links
        // Inserts additional markup after the closing tag of the paragraph
        // containing the example link
        markdown.core.ruler.push('insert_example_links', state => {
          state.tokens.forEach((token, idx) => {
            if (!token.children) {
              return
            }

            let exampleLink
            let exampleTitle = ''
            let insertToken

            token.children.some((childToken, childIdx) => {
              exampleLink = examples.getLink(childToken)

              // Extract link title (to be used in codepen link, e.g.)
              if (exampleLink) {
                token.children
                  .slice(childIdx)
                  .some((followingChildToken, followingChildIdx) => {
                    if (followingChildToken.type === 'text') {
                      exampleTitle += followingChildToken.content

                      // Wrap link text with span
                      followingChildToken.type = 'html_inline'
                      followingChildToken.content = `<span class="example-link">${
                        followingChildToken.content
                      }</span>`
                    }

                    if (followingChildToken.type === 'link_close') {
                      return true
                    }
                  })

                return true
              }
            })

            // Create new token to be inserted
            if (exampleLink) {
              const examplePath = path.isAbsolute(exampleLink)
                ? path.join(rootDir, exampleLink)
                : path.resolve(path.dirname(filePath), exampleLink)
              const example = examples.getExample(
                exampleTitle,
                examplePath,
                filePath
              )

              // Insert after closing paragraph tag to avoid invalid markup
              const insertTokenIdx =
                idx +
                state.tokens
                  .slice(idx)
                  .findIndex(item => item.type === 'paragraph_close') +
                1

              insertToken = new state.Token('html_inline', '', 0)
              insertToken.content = example

              state.tokens.splice(insertTokenIdx, 0, insertToken)
            }
          })
        })
      })
      .use(() => {
        // Extract title and lead from files, attach to `env` option
        markdown.core.ruler.push('extract_meta', state => {
          state.tokens.some((token, idx) => {
            if (token.type === 'heading_open') {
              let title = ''
              const level = parseInt(token.tag.match(/[0-9]+/)[0], 10)

              if (level === 1) {
                state.tokens[idx + 1].children.forEach(child => {
                  if (child.type === 'text') {
                    title += child.content
                  }
                })

                // Expose title
                state.env.title = title
              }
            }

            if (token.type === 'paragraph_open') {
              let lead = ''

              state.tokens[idx + 1].children.forEach(child => {
                if (child.type === 'text') {
                  lead += child.content
                }
              })

              // Expose lead
              state.env.lead = lead

              // Stop iterating
              return true
            }
          })
        })
      })
  )
}
