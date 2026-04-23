import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'user-guide',
    {
      type: 'category',
      label: 'Technical',
      collapsed: false,
      items: ['technical/architecture', 'technical/feature-development'],
    },
    {
      type: 'category',
      label: 'Project Governance',
      collapsed: true,
      items: [
        'project/specs/excel-data-model-studio-spec',
        'project/changelist-tracker',
        'project/context-admin',
        'project/specs/spec-template',
      ],
    },
  ],
};

export default sidebars;
