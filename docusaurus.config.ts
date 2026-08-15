import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Kalyan Ram Chimmili',
  tagline: 'Network Engineer at IG Group',

  future: {
    v4: true,
  },

  url: 'https://kalyanramchimmili.github.io',
  baseUrl: '/',

  organizationName: 'kalyanramchimmili',
  projectName: 'kalyanramchimmili.github.io',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/kalyanramchimmili/kalyanramchimmili.github.io/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl:
            'https://github.com/kalyanramchimmili/kalyanramchimmili.github.io/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'documentation',
        path: 'documentation',
        routeBasePath: 'documentation',
        sidebarPath: './sidebarsDocumentation.ts',
        editUrl:
          'https://github.com/kalyanramchimmili/kalyanramchimmili.github.io/tree/main/',
        sidebarItemsGenerator: async ({defaultSidebarItemsGenerator, ...args}) => {
          const items = await defaultSidebarItemsGenerator(args);
          return items.filter(
            (item) => !(item.type === 'doc' && item.id === 'index'),
          );
        },
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Kalyan Ram Chimmili',
      items: [
        {to: '/docs/projects', label: 'Projects', position: 'left'},
        {to: '/docs/leetcode', label: 'LeetCode', position: 'left'},
        {to: '/documentation', label: 'Documentation', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/kalyanramchimmili',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
