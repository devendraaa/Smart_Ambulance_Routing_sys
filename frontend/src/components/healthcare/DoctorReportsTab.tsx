"use client";

import { useState, useEffect } from "react";
import { FileText, Search, Plus, X, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PatientTest {
  id: string;
  patient_email: string;
  test_type: string;
  appointment_id?: string;
  status: string;
  payment_status: string;
  payment_amount?: number;
  report_url?: string;
  notes?: string;
  created_at: string;
}

const TEST_TYPES = [
  "MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG",
  "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"
];

export default function DoctorReportsTab() {
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [newTest, setNewTest] = useState({
    patient_email: "",
    test_type: "Blood Test",
    notes: "",
  });

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_tests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setTests(data || []);
    } catch (err) {
      console.error("Error loading tests:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter((test) => {
    const matchesSearch = test.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.test_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || test.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddTest = async () => {
    if (!newTest.patient_email) {
      alert("Patient email is required");
      return;
    }

    try {
      const { error } = await supabase.from("patient_tests").insert([{
        patient_email: newTest.patient_email,
        test_type: newTest.test_type,
        notes: newTest.notes,
        status: "ordered",
        payment_status: "pending",
      }]);

      if (error) throw error;

      setShowAddModal(false);
      setNewTest({ patient_email: "", test_type: "Blood Test", notes: "" });
      loadTests();
    } catch (err) {
      console.error("Error adding test:", err);
      alert("Failed to add test");
    }
  };

  const updateTestStatus = async (testId: string, newStatus: string, reportUrl?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (reportUrl) updateData.report_url = reportUrl;

      await supabase.from("patient_tests").update(updateData).eq("id", testId);
      setTests(tests.map((test) => test.id === testId ? { ...test, ...updateData } : test));
      setSelectedTest(null);
    } catch (err) {
      console.error("Error updating test:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Completed</span>;
      case "confirmed":
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Confirmed</span>;
      case "ordered":
        return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">Ordered</span>;
      case "payment_pending":
        return <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">Payment Pending</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Patient Test Reports
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by email or test..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="ordered">Ordered</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Test
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading tests...</div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tests found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Test Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Report</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTests.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{test.patient_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{test.test_type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(test.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(test.status)}</td>
                  <td className="px-4 py-3">
                    {test.report_url ? (
                      <a href={test.report_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View Report
                      </a>
                    ) : (
                      <span className="text-gray-400">Not uploaded</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedTest(test)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Test Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Book New Test</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Email *</label>
                <input
                  type="email"
                  value={newTest.patient_email}
                  onChange={(e) => setNewTest({ ...newTest, patient_email: e.target.value })}
                  placeholder="patient@example.com"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <select
                  value={newTest.test_type}
                  onChange={(e) => setNewTest({ ...newTest, test_type: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                >
                  {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newTest.notes}
                  onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })}
                  placeholder="Any specific instructions..."
                  rows={3}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleAddTest}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Book Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Test Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Update Test Status</h3>
              <button onClick={() => setSelectedTest(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Patient: <span className="font-medium text-gray-900">{selectedTest.patient_email}</span></p>
                <p className="text-sm text-gray-600">Test: <span className="font-medium text-gray-900">{selectedTest.test_type}</span></p>
                <p className="text-sm text-gray-600">Current Status: {getStatusBadge(selectedTest.status)}</p>
              </div>

              <button
                onClick={() => updateTestStatus(selectedTest.id, "confirmed")}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Confirm Test
              </button>

              <button
                onClick={() => {
                  const url = prompt("Enter report URL (e.g., Google Drive link):");
                  if (url) updateTestStatus(selectedTest.id, "completed", url);
                }}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Report
              </button>

              <button
                onClick={() => setSelectedTest(null)}
                className="w-full px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}