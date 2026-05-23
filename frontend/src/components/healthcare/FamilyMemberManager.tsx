"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UserPlus, X, Loader2, AlertTriangle, CheckCircle2, Plus, Trash2, Edit3, Users, Droplet, Phone, MapPin, Heart, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PatientBarcodeCard from "./PatientBarcodeCard";

const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
];

const RELIGIONS = [
  "Hindu", "Muslim", "Christian", "Buddhist", "Sikh", "Jain", "Parsis", "Other",
];

export type FamilyMember = {
  id: string;
  patient_email: string;
  patient_uhid?: string;
  name: string;
  age: number | null;
  blood_group: string;
  phone: string;
  address: string;
  religion: string;
  created_at: string;
};

type FamilyMemberManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  onMemberSelect?: (member: FamilyMember) => void;
};

const MAX_MEMBERS = 5;

export default function FamilyMemberManager({ isOpen, onClose, onMemberSelect }: FamilyMemberManagerProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showQrCode, setShowQrCode] = useState<FamilyMember | null>(null);
  const [formName, setFormName] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formBloodGroup, setFormBloodGroup] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formReligion, setFormReligion] = useState("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("patient_email", user.email!)
        .order("created_at", { ascending: true });
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching family members:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchMembers();
  }, [isOpen, fetchMembers]);

  const resetForm = () => {
    setFormName("");
    setFormAge("");
    setFormBloodGroup("");
    setFormPhone("");
    setFormAddress("");
    setFormReligion("");
    setEditingId(null);
    setShowForm(false);
    setError("");
    setSuccess("");
  };

  const handleAddNew = () => {
    setError("");
    setSuccess("");
    setEditingId(null);
    // If there's at least one existing member, pre-fill address & religion from the first member
    if (members.length > 0) {
      const first = members[0];
      setFormAddress(first.address || "");
      setFormReligion(first.religion || "");
    }
    setShowForm(true);
  };

  const handleEdit = (member: FamilyMember) => {
    setError("");
    setSuccess("");
    setEditingId(member.id);
    setFormName(member.name);
    setFormAge(member.age?.toString() || "");
    setFormBloodGroup(member.blood_group || "");
    setFormPhone(member.phone || "");
    setFormAddress(member.address || "");
    setFormReligion(member.religion || "");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this family member?")) return;
    try {
      const { error: delErr } = await supabase
        .from("patient_family_members")
        .delete()
        .eq("id", id);
      if (delErr) throw delErr;
      setMembers((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error("Error deleting member:", err);
      setError(err instanceof Error ? err.message : "Failed to delete member");
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!formName.trim()) { setError("Name is required"); return; }
    if (formAge && (parseInt(formAge) < 1 || parseInt(formAge) > 150)) { setError("Enter a valid age (1-150)"); return; }
    if (!formBloodGroup) { setError("Blood group is required"); return; }
    if (!formPhone.trim() || !/^\d{10}$/.test(formPhone.trim())) { setError("Enter a valid 10-digit phone number"); return; }
    if (!editingId && members.length >= MAX_MEMBERS) { setError(`You can only add up to ${MAX_MEMBERS} family members`); return; }

    // For the first member, address and religion are required
    const isFirstMember = members.length === 0 && !editingId;
    if (isFirstMember) {
      if (!formAddress.trim()) { setError("Address is required for the first member"); return; }
      if (!formReligion.trim()) { setError("Religion is required for the first member"); return; }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login to continue"); setSaving(false); return; }

      // For non-first members or when editing non-primary, use shared address/religion from first member
      const resolvedAddress = formAddress.trim() || (members.length > 0 ? members[0].address || "" : "");
      const resolvedReligion = formReligion.trim() || (members.length > 0 ? members[0].religion || "" : "");

      const payload = {
        patient_email: user.email!,
        name: formName.trim(),
        age: formAge ? parseInt(formAge) : null,
        blood_group: formBloodGroup,
        phone: formPhone.trim(),
        address: resolvedAddress,
        religion: resolvedReligion,
      };

      if (editingId) {
        const { error: updErr } = await supabase
          .from("patient_family_members")
          .update(payload)
          .eq("id", editingId);
        if (updErr) throw updErr;
        setMembers((prev) => prev.map((m) => m.id === editingId ? { ...m, ...payload } : m));
        setSuccess("Member updated successfully");
      } else {
        const { data, error: insErr } = await supabase
          .from("patient_family_members")
          .insert([payload])
          .select();
        if (insErr) throw insErr;
        if (data) setMembers((prev) => [...prev, ...data]);
        setSuccess("Member added successfully");
      }

      resetForm();
    } catch (err) {
      console.error("Error saving member:", err);
      setError(err instanceof Error ? err.message : "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-gray-100"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Family Members</h2>
              <p className="text-purple-100 text-xs">
                {members.length}/{MAX_MEMBERS} members added
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-3 border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-emerald-600 text-sm bg-emerald-50 p-3 rounded-xl mb-3 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </motion.div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <>
              {/* Member List */}
              {members.length > 0 && (
                <div className="space-y-2 mb-4">
                  {members.map((member, idx) => (
                    <div key={member.id} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
                            <UserPlus className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {member.name}
                              {idx === 0 && <span className="ml-1.5 text-[10px] font-medium text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Primary</span>}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {member.age && <span>{member.age}y</span>}
                              {member.blood_group && <span>{member.blood_group}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onMemberSelect && (
                            <button onClick={() => onMemberSelect(member)} className="p-1.5 rounded-lg hover:bg-emerald-100 transition" title="Select for booking">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </button>
                          )}
                          <button onClick={() => setShowQrCode(member)} className="p-1.5 rounded-lg hover:bg-purple-100 transition" title="Show QR Code">
                            <QrCode className="w-3.5 h-3.5 text-purple-500" />
                          </button>
                          <button onClick={() => handleEdit(member)} className="p-1.5 rounded-lg hover:bg-gray-200 transition" title="Edit">
                            <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(member.id)} className="p-1.5 rounded-lg hover:bg-red-100 transition" title="Remove">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                      {member.phone && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="w-3 h-3" /> {member.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!showForm && (
                <>
                  {members.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">No family members added yet</p>
                      <p className="text-xs text-gray-400">Add up to {MAX_MEMBERS} members</p>
                    </div>
                  )}
                  {members.length < MAX_MEMBERS && (
                    <button onClick={handleAddNew}
                      className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-indigo-600 transition flex items-center justify-center gap-2 shadow-md">
                      <Plus className="w-4 h-4" /> Add Member
                    </button>
                  )}
                  {members.length >= MAX_MEMBERS && (
                    <p className="text-center text-xs text-amber-600 bg-amber-50 py-2 rounded-lg border border-amber-200">
                      Maximum {MAX_MEMBERS} family members reached
                    </p>
                  )}
                </>
              )}

              {/* Add/Edit Form */}
              {showForm && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    {editingId ? "Edit Member" : members.length === 0 ? "Add Primary Member" : "Add Family Member"}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                      <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Name" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                      <input type="number" min="1" max="150" value={formAge} onChange={(e) => setFormAge(e.target.value)} placeholder="Age" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        <Droplet className="w-3 h-3 inline mr-1" />Blood Group *
                      </label>
                      <select value={formBloodGroup} onChange={(e) => setFormBloodGroup(e.target.value)} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition bg-white">
                        <option value="">Select</option>
                        {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        <Phone className="w-3 h-3 inline mr-1" />Phone *
                      </label>
                      <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="10-digit number" maxLength={10} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition" />
                    </div>
                  </div>

                  {/* Address & Religion — full fields for first member */}
                  {(members.length === 0 || editingId === members[0]?.id) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          <MapPin className="w-3 h-3 inline mr-1" />Address *{members.length > 0 ? " (shared)" : ""}
                        </label>
                        <textarea value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Full address" rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          <Heart className="w-3 h-3 inline mr-1" />Religion *{members.length > 0 ? " (shared)" : ""}
                        </label>
                        <select value={formReligion} onChange={(e) => setFormReligion(e.target.value)} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none transition bg-white">
                          <option value="">Select religion</option>
                          {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Address & Religion — auto-fill indicator for subsequent members */}
                  {members.length > 0 && editingId !== members[0]?.id && !editingId && (
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-xs text-purple-700">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Address & Religion will be shared from the primary member
                      </p>
                      {members[0]?.address && <p className="text-xs text-purple-600 mt-1 ml-5">{members[0].address}</p>}
                      {members[0]?.religion && <p className="text-xs text-purple-600 ml-5">{members[0].religion}</p>}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg hover:from-purple-600 hover:to-indigo-600 transition flex items-center gap-1.5 disabled:opacity-50">
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-4 h-4" /> {editingId ? "Update" : "Save"}</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* QR Code Modal */}
      {showQrCode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[10000]" onClick={() => setShowQrCode(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">Patient QR Code</span>
              </div>
              <button onClick={() => setShowQrCode(null)} className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div className="p-4">
              <PatientBarcodeCard member={showQrCode} size={180} />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
