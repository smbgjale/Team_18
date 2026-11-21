"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages: string;
            autoDisplay: boolean;
          },
          elementId: string,
        ) => void;
      };
    };
  }
}

function patchReactTranslateDomConflicts() {
  if (typeof Node !== "function" || !Node.prototype) return;
  if ((Node.prototype as { __homelyTranslatePatch?: boolean }).__homelyTranslatePatch) return;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  (Node.prototype as { __homelyTranslatePatch?: boolean }).__homelyTranslatePatch = true;
}

function mountTranslateWidget() {
  if (!window.google?.translate) return;
  const host = document.getElementById("google_translate_element");
  if (!host || host.childNodes.length) return;
  new window.google.translate.TranslateElement(
    {
      pageLanguage: "en",
      includedLanguages: "en,am,om",
      autoDisplay: false,
    },
    "google_translate_element",
  );
}

export function GoogleTranslate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    patchReactTranslateDomConflicts();
    window.googleTranslateElementInit = mountTranslateWidget;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    mountTranslateWidget();
  }, [ready]);

  return (
    <>
      <div id="google_translate_element" className="google-translate-host notranslate" aria-hidden />
      {ready ? (
        <Script
          src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}
