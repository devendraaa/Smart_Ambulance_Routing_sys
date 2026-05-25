"use client";

import { useState } from "react";
import { X, Search, AlertTriangle } from "lucide-react";
import {
  COMMON_MEDICINES,
  DOSAGE_OPTIONS,
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_OPTIONS,
  ROUTE_OPTIONS,
  REFILL_OPTIONS,
} from "@/lib/medicines";

export interface MedicineFormData {
  medicine_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  route: string;
  is_prn: boolean;
  quantity: string;
  refills: string;
}

interface MedicineFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MedicineFormData) => Promise<void>;
  initialData?: MedicineFormData;
  existingMedicineNames?: string[];
}

const defaultData: MedicineFormData = {
  medicine_name: "",
  dosage: "",
  frequency: "Once daily",
  timing: "After meal",
  duration: "7 days",
  instructions: "",
  route: "Oral",
  is_prn: false,
  quantity: "",
  refills: "0",
};

export default function MedicineForm({ open, onClose, onSave, initialData, existingMedicineNames }: MedicineFormProps) {
  const [form, setForm] = useState<MedicineFormData>(initialData || { ...defaultData });
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!initialData;

  if (!open) return null;

  const handleSelectMedicine = (name: string) => {
    setForm({ ...form, medicine_name: name });
    setMedicineSearch("");
    setShowDropdown(false);
  };

  const handleSave = async () => {
    setError("");
    if (!form.medicine_name.trim()) {
      setError("Medicine name is required");
      return;
    }
    const duplicate = existingMedicineNames?.find(
      n => n.toLowerCase() === form.medicine_name.toLowerCase() && n !== initialData?.medicine_name
    );
    if (duplicate) {
      setError(`"${form.medicine_name}" is already in the list`);
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      if (!initialData) setForm({ ...defaultData });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medicine");
    } finally {
      setSaving(false);
    }
  };

  const filteredMeds = medicineSearch
    ? COMMON_MEDICINES.filter(
        m =>
          m.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
          m.category.toLowerCase().includes(medicineSearch.toLowerCase())
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-semibold">{isEdit ? "Edit Medicine" : "Add Medicine"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
            <div className="relative space-y-2">
              {!isEdit && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={medicineSearch}
                      onChange={e => { setMedicineSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search medicine (e.g., fever, pain, bp)..."
                      className="w-full pl-9 rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {showDropdown && filteredMeds.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredMeds.slice(0, 10).map(med => (
                        <button
                          key={med.name}
                          type="button"
                          onClick={() => handleSelectMedicine(med.name)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-900">{med.name}</span>
                          <span className="text-xs text-gray-500">{med.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <input
                type="text"
                value={form.medicine_name}
                onChange={e => setForm({ ...form, medicine_name: e.target.value })}
                placeholder={isEdit ? "" : "Or enter custom medicine name"}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dosage</label>
              <select
                value={form.dosage}
                onChange={e => setForm({ ...form, dosage: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                <option value="">Select</option>
                {DOSAGE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Route</label>
              <select
                value={form.route}
                onChange={e => setForm({ ...form, route: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Timing</label>
              <select
                value={form.timing}
                onChange={e => setForm({ ...form, timing: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select
                value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Refills</label>
              <select
                value={form.refills}
                onChange={e => setForm({ ...form, refills: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                {REFILL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="text"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              placeholder="e.g., 30 tablets, 1 bottle"
              className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_prn"
              checked={form.is_prn}
              onChange={e => setForm({ ...form, is_prn: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="is_prn" className="text-sm text-gray-700">PRN (Take as needed)</label>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={form.instructions}
              onChange={e => setForm({ ...form, instructions: e.target.value })}
              placeholder="Any special instructions..."
              rows={2}
              className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
          >
            {saving ? "Saving..." : isEdit ? "Update Medicine" : "Add Medicine"}
          </button>
        </div>
      </div>
    </div>
  );
}
