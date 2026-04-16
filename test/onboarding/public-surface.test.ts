import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandIntroScreen, PhotoUploadCTA, PublicOnboardingFrame } from "../../src/components/onboarding/public-surface.tsx";
import { buildOnboardingIntroCopy } from "../../src/lib/onboarding/wow-surface.ts";
import { resolveVenusTenantBrand } from "../../src/lib/venus/brand.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("BrandIntroScreen renders premium intro with and without branding", () => {
  const copy = buildOnboardingIntroCopy("Loja Aurora");
  const withLogo = resolveVenusTenantBrand({
    orgSlug: "loja-aurora",
    branchName: "Loja Aurora",
    logoUrl: "https://cdn.example.com/logo.png",
  });

  const withLogoHtml = renderToStaticMarkup(
    React.createElement(BrandIntroScreen, {
      brand: withLogo,
      copy,
      onStart: () => undefined,
    })
  );

  assert.match(withLogoHtml, /Loja Aurora/);
  assert.match(withLogoHtml, /img/);
  assert.match(withLogoHtml, /Começar/);

  const withoutLogo = resolveVenusTenantBrand({
    orgSlug: "loja-aurora",
  });
  const withoutLogoHtml = renderToStaticMarkup(
    React.createElement(BrandIntroScreen, {
      brand: withoutLogo,
      copy,
      onStart: () => undefined,
    })
  );

  assert.match(withoutLogoHtml, /Loja Aurora/);
  assert.doesNotMatch(withoutLogoHtml, /img/);
});

run("PhotoUploadCTA renders a single primary CTA and fallback", () => {
  const html = renderToStaticMarkup(
    React.createElement(PhotoUploadCTA, {
      label: "Enviar foto agora",
      helperText: "Abra a leitura premium com uma foto simples.",
      secondaryLabel: "Continuar sem foto",
      onPrimary: () => undefined,
      onSecondary: () => undefined,
    })
  );

  assert.match(html, /Enviar foto agora/);
  assert.match(html, /Continuar sem foto/);
  assert.match(html, /Abra a leitura premium/);
});

run("PublicOnboardingFrame keeps the chat hidden until the CTA is clicked", () => {
  const copy = buildOnboardingIntroCopy("Loja Aurora");
  const brand = resolveVenusTenantBrand({
    orgSlug: "loja-aurora",
    branchName: "Loja Aurora",
  });

  const introHtml = renderToStaticMarkup(
    React.createElement(
      PublicOnboardingFrame,
      {
        started: false,
        brand,
        copy,
        onStart: () => undefined,
      },
      React.createElement("div", { "data-testid": "chat-surface" }, "chat aberto")
    )
  );

  assert.match(introHtml, /Começar/);
  assert.doesNotMatch(introHtml, /chat aberto/);

  const chatHtml = renderToStaticMarkup(
    React.createElement(
      PublicOnboardingFrame,
      {
        started: true,
        brand,
        copy,
        onStart: () => undefined,
      },
      React.createElement("div", { "data-testid": "chat-surface" }, "chat aberto")
    )
  );

  assert.match(chatHtml, /chat aberto/);
  assert.doesNotMatch(chatHtml, /Começar/);
});

run("scanner opt-in CTA uses a direct button navigation path", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/scanner/opt-in/page.tsx"), "utf8");

  assert.match(source, /handleStartScan/);
  assert.match(source, /router\.push/);
  assert.doesNotMatch(source, /<Link href=\/scanner\/face/);
});

run("scanner face and body pages preserve org through navigation", () => {
  const faceSource = fs.readFileSync(path.join(process.cwd(), "src/app/scanner/face/page.tsx"), "utf8");
  const bodySource = fs.readFileSync(path.join(process.cwd(), "src/app/scanner/body/page.tsx"), "utf8");

  assert.match(faceSource, /useSearchParams/);
  assert.match(faceSource, /scanner\/body\?org=/);
  assert.match(bodySource, /useSearchParams/);
  assert.match(bodySource, /processing\?org=/);
});

run("processing and result pages support the no-tenant preview fallback", () => {
  const processingSource = fs.readFileSync(path.join(process.cwd(), "src/app/processing/page.tsx"), "utf8");
  const resultSource = fs.readFileSync(path.join(process.cwd(), "src/app/result/page.tsx"), "utf8");

  assert.match(processingSource, /TENANT_RESOLUTION_FAILED/);
  assert.match(processingSource, /\/result\?preview=1/);
  assert.match(resultSource, /previewMode/);
  assert.match(resultSource, /buildResultSurface\(onboardingData, null, null\)/);
});

run("body photo upload keeps mobile capture and broad file input support", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/components/ui/BodyPhotoUpload.tsx"), "utf8");

  assert.match(source, /capture="environment"/);
  assert.match(source, /image\/heic/);
  assert.match(source, /image\/heif/);
});

run("try-on pipeline keeps timeout fallback and local generation logs", () => {
  const hookSource = fs.readFileSync(path.join(process.cwd(), "src/hooks/useTryOn.ts"), "utf8");
  const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/tryon/premium-fallback/route.ts"), "utf8");

  assert.match(hookSource, /TRYON_MAX_WAIT_MS/);
  assert.match(hookSource, /fallback activated/);
  assert.match(hookSource, /lateSuccessNotice/);
  assert.match(hookSource, /TRYON_PREMIUM_REFINED_MESSAGE/);
  assert.match(routeSource, /\[tryon\/premium-fallback\] request start/);
  assert.match(routeSource, /\[tryon\/premium-fallback\] request completed/);
  assert.match(routeSource, /TRYON_PREMIUM_FALLBACK_MESSAGE/);
});

console.log("\n--- Public onboarding surface tests passed ---");
