"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { Box3, Vector3, type Mesh, type Object3D } from "three";
import type { Dims } from "@/lib/scene-layout";

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function fitToDims(source: Object3D, dims: Dims) {
  const object = source.clone(true);
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  object.updateWorldMatrix(true, true);
  const size = new Box3().setFromObject(object).getSize(new Vector3());
  object.scale.set(dims.w / Math.max(size.x, 1e-4), dims.h / Math.max(size.y, 1e-4), dims.d / Math.max(size.z, 1e-4));
  object.updateWorldMatrix(true, true);
  const fitted = new Box3().setFromObject(object);
  const center = fitted.getCenter(new Vector3());
  object.position.set(object.position.x - center.x, object.position.y - fitted.min.y, object.position.z - center.z);
  return object;
}

function FittedGlb({ url, dims }: { url: string; dims: Dims }) {
  const gltf = useGLTF(url);
  const { w, h, d } = dims;
  const object = useMemo(() => fitToDims(gltf.scene, { w, h, d }), [gltf.scene, w, h, d]);
  return <primitive object={object} />;
}

export function GlbFurniture({ url, dims, fallback }: { url: string; dims: Dims; fallback: ReactNode }) {
  return (
    <ModelErrorBoundary key={url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <FittedGlb url={url} dims={dims} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
