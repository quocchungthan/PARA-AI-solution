import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Box3, Vector3, MOUSE, TOUCH, MathUtils, OrthographicCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { OfficeLayout } from "../layout";
import type { CameraPose, OfficeCameraHandle } from "../types";
export function OfficeCamera({
  layout,
  pose,
  onChange,
  controllerRef,
}: {
  layout: OfficeLayout;
  pose: CameraPose | null;
  onChange: (p: CameraPose) => void;
  controllerRef: RefObject<OfficeCameraHandle | null>;
  reducedMotion: boolean;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const latest = useRef({ pose, onChange });
  latest.current = { pose, onChange };
  useEffect(() => {
    const c = camera as OrthographicCamera;
    const controls = new OrbitControls(c, gl.domElement);
    controls.enableRotate = true;
    controls.enableDamping = false;
    controls.minPolarAngle = MathUtils.degToRad(10);
    controls.maxPolarAngle = MathUtils.degToRad(85);
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = MOUSE.PAN;
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_PAN;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.8;
    c.position.set(-26, 28, 40);
    controls.target.set(0, 0, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
    const bounds = new Box3(
      new Vector3(-15, -0.5, -10),
      new Vector3(15, 4, 10),
    );
    let maxX = 0,
      maxY = 0;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const v = new Vector3(x, y, z).applyMatrix4(c.matrixWorldInverse);
          maxX = Math.max(maxX, Math.abs(v.x));
          maxY = Math.max(maxY, Math.abs(v.y));
        }
    const homeZoom = Math.min(
      size.width / (maxX * 2.2),
      size.height / (maxY * 2.2),
    );
    const initial = latest.current.pose;
    let fitZoom =
      initial?.viewportWidth === size.width && initial.homeZoom
        ? initial.homeZoom
        : homeZoom;
    function zoomBounds() {
      controls.minZoom = fitZoom * 0.6;
      controls.maxZoom = fitZoom * 2.5;
    }
    zoomBounds();
    function save() {
      latest.current.onChange({
        position: c.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        zoom: c.zoom,
        homeZoom: fitZoom,
        viewportWidth: size.width,
      });
      invalidate();
    }
    function home() {
      fitZoom = homeZoom;
      zoomBounds();
      c.position.set(-26, 28, 40);
      controls.target.set(0, 0, 0);
      c.zoom = homeZoom;
      c.updateProjectionMatrix();
      controls.update();
      save();
    }
    controllerRef.current = {
      home,
      focusRoom(id) {
        const r = layout.rooms.find((r) => r.id === id);
        if (!r) return;
        fitZoom = homeZoom;
        zoomBounds();
        const offset = c.position.clone().sub(controls.target);
        controls.target.set(r.x + r.width / 2, 0, r.z + r.depth / 2);
        c.position.copy(controls.target).add(offset);
        c.zoom = homeZoom * 1.85;
        c.updateProjectionMatrix();
        controls.update();
        save();
      },
    };
    if (initial) {
      c.position.set(...initial.position);
      controls.target.set(...initial.target);
      const zoom =
        initial.viewportWidth !== undefined &&
        initial.viewportWidth !== size.width &&
        initial.homeZoom
          ? (initial.zoom / initial.homeZoom) * homeZoom
          : initial.zoom;
      c.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, zoom));
      c.updateProjectionMatrix();
      controls.update();
      save();
    } else home();
    const redraw = () => invalidate();
    controls.addEventListener("change", redraw);
    controls.addEventListener("end", save);
    return () => {
      controls.removeEventListener("change", redraw);
      controls.removeEventListener("end", save);
      controls.dispose();
      controllerRef.current = null;
    };
  }, [camera, gl, size.width, size.height, layout, controllerRef, invalidate]);
  return null;
}
