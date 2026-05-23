"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";
import { FamilyMember } from "./FamilyMemberManager";

type Props = {
  member: FamilyMember;
  size?: number;
};

function encodeMemberData(member: FamilyMember): string {
  const data = {
    uhid: member.patient_uhid || member.id,
    name: member.name,
    bg: member.blood_group || "",
  };
  return JSON.stringify(data);
}

export default function PatientBarcodeCard({ member, size = 160 }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    const canvas = qrRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${member.patient_uhid || member.id}_${member.name.replace(/\s+/g, "_")}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const canvas = qrRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const win = window.open("");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>${member.name} - QR Code</title></head>
        <body style="text-align:center;padding:40px;font-family:sans-serif;">
          <img src="${url}" style="width:300px;height:300px;" />
          <h2 style="margin-top:12px;margin-bottom:4px;">${member.name}</h2>
          <p style="margin:0;color:#666;font-size:14px;">${member.patient_uhid || "—"}</p>
          ${member.blood_group ? `<p style="margin:4px 0;color:#666;font-size:14px;">Blood: ${member.blood_group}</p>` : ""}
          <p style="margin-top:20px;color:#999;font-size:11px;">Smart Ambulance Healthcare</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!member.patient_uhid) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">QR code will be available once UHID is generated</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
      <div className="flex justify-center mb-2">
        <QRCodeCanvas
          ref={qrRef}
          value={encodeMemberData(member)}
          size={size}
          level="M"
          includeMargin
        />
      </div>
      <p className="text-sm font-bold text-gray-900">{member.name}</p>
      <p className="text-[10px] font-mono text-gray-500 mt-0.5">{member.patient_uhid}</p>
      {member.blood_group && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded-full border border-red-200">
          {member.blood_group}
        </span>
      )}
      <div className="flex items-center justify-center gap-2 mt-3">
        <button onClick={handleDownload}
          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition border border-blue-200">
          <Download className="w-3 h-3" /> Download
        </button>
        <button onClick={handlePrint}
          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition border border-gray-200">
          <Printer className="w-3 h-3" /> Print
        </button>
      </div>
    </div>
  );
}
