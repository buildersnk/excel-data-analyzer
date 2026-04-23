import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import MountainSvg from '@site/static/img/undraw_docusaurus_mountain.svg';
import TreeSvg from '@site/static/img/undraw_docusaurus_tree.svg';
import ReactSvg from '@site/static/img/undraw_docusaurus_react.svg';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Data Import Workflow',
    Svg: MountainSvg,
    description: (
      <>
        Upload multiple Excel and CSV files, inspect columns instantly, and
        convert sheets into source tables for modeling.
      </>
    ),
  },
  {
    title: 'Visual Data Modeling',
    Svg: TreeSvg,
    description: (
      <>
        Build relationships between entities on a canvas and validate your data
        model before writing SQL.
      </>
    ),
  },
  {
    title: 'SQL and Charts',
    Svg: ReactSvg,
    description: (
      <>
        Query your modeled data in SQL Lab and generate chart previews to
        explore output visually.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={clsx('text--center', styles.featureCard)}>
        <Svg className={styles.featureSvg} role="img" />
        <div className="padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
