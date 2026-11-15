"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button, Modal } from "antd";
import JsBarcode from "jsbarcode";
import { QRCodeCanvas } from "qrcode.react";

type RackLocationPrintData = {
  id?: string;
  name: string;
  code: string;
  barcodeValue?: string | null;
  warehouse: {
    name: string;
    code: string;
  };
};

type RackLocationLabelPrintProps = {
  open: boolean;
  autoPrint?: boolean;
  rackLocation: RackLocationPrintData | null;
  onClose: () => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function RackLocationLabelPrint({
  open,
  autoPrint = false,
  rackLocation,
  onClose,
}: RackLocationLabelPrintProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const barcodeValue = rackLocation?.barcodeValue || rackLocation?.code || "";

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined" || !barcodeValue) return "";

    return `${window.location.origin}/rack-scan?barcode=${encodeURIComponent(
      barcodeValue,
    )}`;
  }, [barcodeValue]);

  function openPrintWindow() {
    if (!rackLocation || !barcodeValue) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) return;

    const barcodeSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );

    JsBarcode(barcodeSvg, barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 56,
      margin: 8,
      width: 1.6,
    });

    const qrDataUrl = qrCanvasRef.current?.toDataURL("image/png") || "";

    const safeName = escapeHtml(rackLocation.name);
    const safeRackCode = escapeHtml(rackLocation.code);
    const safeWarehouseCode = escapeHtml(rackLocation.warehouse.code);
    const safeBarcodeValue = escapeHtml(barcodeValue);

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Rack Label</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              width: 210mm;
              height: 297mm;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, sans-serif;
              overflow: hidden;
            }

            body {
              display: block;
            }

            .a4-page {
              width: 186mm;
              height: 273mm;
              margin: 0 auto;
              padding: 0;
              background: #ffffff;

              display: flex;
              align-items: flex-start;
              justify-content: center;

              page-break-after: avoid;
              page-break-before: avoid;
              page-break-inside: avoid;
              overflow: hidden;
            }

            .label {
              width: 90mm;
              min-height: 58mm;
              margin-top: 18mm;
              padding: 8mm;
              border: 1px solid #cbd5e1;
              background: #ffffff;
              text-align: center;

              page-break-after: avoid;
              page-break-before: avoid;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .eyebrow {
              margin-bottom: 2mm;
              color: #64748b;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 1.5px;
              text-transform: uppercase;
            }

            .name {
              margin-bottom: 1.5mm;
              color: #0f172a;
              font-size: 18px;
              font-weight: 800;
              line-height: 1.15;
            }

            .code {
              margin-bottom: 4mm;
              color: #475569;
              font-size: 11px;
              line-height: 1.3;
            }

            .barcode {
              width: 100%;
              margin-top: 2mm;
              margin-bottom: 4mm;
            }

            .barcode svg {
              display: block;
              width: 100%;
              height: auto;
              max-height: 25mm;
            }

            .qr-row {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4mm;
              margin-top: 3mm;
            }

            .qr-row img {
              width: 22mm;
              height: 22mm;
              flex: 0 0 auto;
            }

            .qr-text {
              max-width: 45mm;
              color: #475569;
              font-size: 8px;
              line-height: 1.35;
              text-align: left;
              word-break: break-word;
            }

            .barcode-text {
              margin-top: 1mm;
              color: #334155;
              font-family: monospace;
              font-size: 8px;
              word-break: break-all;
            }

            @media print {
              html,
              body {
                width: 210mm;
                height: 297mm;
                overflow: hidden;
              }

              .a4-page {
                width: 186mm;
                height: 273mm;
                overflow: hidden;
              }
            }
          </style>
        </head>

        <body>
          <div class="a4-page">
            <div class="label">
              <div class="eyebrow">Rack Location</div>

              <div class="name">${safeName}</div>

              <div class="code">
                ${safeWarehouseCode} / ${safeRackCode}
              </div>

              <div class="barcode">
                ${barcodeSvg.outerHTML}
              </div>

              ${
                qrDataUrl
                  ? `
                    <div class="qr-row">
                      <img src="${qrDataUrl}" alt="QR Code" />

                      <div class="qr-text">
                        Scan QR untuk melihat detail rack location.
                        <div class="barcode-text">${safeBarcodeValue}</div>
                      </div>
                    </div>
                  `
                  : `
                    <div class="barcode-text">${safeBarcodeValue}</div>
                  `
              }
            </div>
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 400);
            };

            window.onafterprint = function () {
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function handlePrint() {
    openPrintWindow();
  }

  useEffect(() => {
    if (!open || !autoPrint || !rackLocation || !barcodeValue) return;

    const timer = window.setTimeout(() => {
      openPrintWindow();
    }, 700);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPrint, rackLocation, barcodeValue]);

  return (
    <Modal
      open={open}
      title="Print Rack Barcode"
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          onClick={handlePrint}
          disabled={!barcodeValue}
        >
          Print
        </Button>,
      ]}
      width={520}
      centered
      destroyOnHidden
    >
      {rackLocation ? (
        <div>
          <div
            id="rack-label-print-area"
            className="mx-auto w-[320px] border border-slate-300 bg-white p-4 text-center"
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Rack Location
            </div>

            <div className="mt-1 text-xl font-bold text-slate-900">
              {rackLocation.name}
            </div>

            <div className="mt-1 text-sm text-slate-600">
              {rackLocation.warehouse.code} / {rackLocation.code}
            </div>

            {barcodeValue ? (
              <div className="mt-3 bg-white">
                <BarcodePreview value={barcodeValue} />
              </div>
            ) : (
              <div className="mt-3 border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                Barcode value belum tersedia.
              </div>
            )}

            {publicUrl ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                <QRCodeCanvas ref={qrCanvasRef} value={publicUrl} size={72} />

                <div className="max-w-[170px] text-left text-[10px] leading-snug text-slate-500">
                  Scan QR untuk melihat detail rack location.
                  <br />
                  <span className="font-mono">{barcodeValue}</span>
                </div>
              </div>
            ) : null}
          </div>

          {publicUrl ? (
            <div className="mt-4 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="mb-1 font-semibold text-slate-700">
                Public scan URL:
              </div>

              <div className="break-all font-mono">{publicUrl}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          Rack location belum dipilih.
        </div>
      )}
    </Modal>
  );
}

function BarcodePreview({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 12,
      height: 48,
      margin: 6,
      width: 1.5,
    });
  }, [value]);

  return <svg ref={svgRef} className="mx-auto max-w-full" />;
}
