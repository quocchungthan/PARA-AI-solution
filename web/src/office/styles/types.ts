import type { OfficeLayout } from '../layout';
import type { Vec3 } from '../types';
export type OfficeStyleId = 'botanical' | 'precinct';
export type OfficeView = { position: Vec3; target: Vec3; zoomRatio: number };
export type OfficeStyleDefinition = {
  id: OfficeStyleId;
  label: string;
  layout: OfficeLayout;
  labelAnchors: Readonly<Record<string,Vec3>>;
  views: Readonly<Record<string,OfficeView>>;
};
