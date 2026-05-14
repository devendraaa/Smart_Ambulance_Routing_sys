"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TestTube, Calendar, CreditCard, CheckCircle2, AlertTriangle, Download, Clock, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { bookTest, getPatientTests, confirmTestPayment, TEST_TYPES, TestBooking } from "@/lib/healthcare";

export default function TestTab() {
  const [tests, setTests] = useState<TestBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Booking form
  const [selectedTest, setSelectedTest] = useState("");
  const [appointmentSlot, setAppointmentSlot] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [pendingTestId, setPendingTestId] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getPatientTests(user.email!);
      setTests(data.tests);
    } catch (err) {
      console.error('Error fetching tests:', err);
    }
  };

  const handleBookTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!selectedTest) { setError("Please select a test"); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login to continue"); return; }

      const testInfo = TEST_TYPES.find(t => t.value === selectedTest);
      const result = await bookTest({
        patient_email: user.email!,
        test_type: selectedTest,
        appointment_slot: appointmentSlot || undefined,
        payment_amount: testInfo?.fee,
      });

      setPendingTestId(result.id);
      setShowPayment(true);
      setSuccess("Test booked! Please complete the payment to confirm.");
      fetchTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book test");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!pendingTestId) return;
    setLoading(true);
    try {
      await confirmTestPayment(pendingTestId, paymentRef || `PAY-${Date.now()}`);
      setSuccess("Payment successful! Your test is confirmed.");
      setShowPayment(false);
      setPendingTestId(null);
      setSelectedTest("");
      setAppointmentSlot("");
      setPaymentRef("");
      fetchTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, paymentStatus: string) => {
    if (status === 'confirmed' || paymentStatus === 'paid') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Confirmed</span>;
    }
    if (status === 'payment_pending') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Payment Pending</span>;
    }
    if (status === 'completed') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Completed</span>;
    }
    if (status === 'cancelled') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Pending</span>;
  };

  return (
    <div className="space-y-6">
      {/* Book Test */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
            <TestTube className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Book Medical Test</h2>
            <p className="text-sm text-gray-500">Schedule a diagnostic test</p>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4"><AlertTriangle className="w-4 h-4" />{error}</div>}
        {success && <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 p-3 rounded-xl mb-4"><CheckCircle2 className="w-4 h-4" />{success}</div>}

        {!showPayment ? (
          <form onSubmit={handleBookTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Test *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TEST_TYPES.map((test) => (
                  <motion.button key={test.value} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedTest(test.value)}
                    className={`p-4 rounded-xl border-2 text-left transition ${selectedTest === test.value ? "border-cyan-500 bg-cyan-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className="font-medium text-gray-900">{test.label}</p>
                    <p className="text-sm text-gray-500">₹{test.fee.toLocaleString()}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Calendar className="w-4 h-4 inline mr-1" />Appointment Slot (Optional)</label>
              <input type="datetime-local" value={appointmentSlot} onChange={(e) => setAppointmentSlot(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-cyan-500 focus:outline-none transition" />
            </div>

            <motion.button type="submit" disabled={loading || !selectedTest} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</> : <><TestTube className="w-5 h-5" />Book Test</>}
            </motion.button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-800 mb-2"><AlertTriangle className="w-5 h-5" /><span className="font-medium">Payment Required</span></div>
              <p className="text-sm text-yellow-700">Test: {selectedTest} - ₹{TEST_TYPES.find(t => t.value === selectedTest)?.fee.toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><CreditCard className="w-4 h-4 inline mr-1" />Payment Reference</label>
              <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Enter payment reference or UTR number" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-cyan-500 focus:outline-none transition" />
            </div>
            <div className="flex gap-3">
              <motion.button type="button" onClick={handlePayment} disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-green-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</> : <><CreditCard className="w-5 h-5" />Confirm Payment</>}
              </motion.button>
              <button onClick={() => { setShowPayment(false); setPendingTestId(null); }} className="px-6 py-3 rounded-xl border-2 border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Test History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Test Reports</h2>
            <p className="text-sm text-gray-500">{tests.length} booking{tests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {tests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <TestTube className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No tests booked yet. Book your first test above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <motion.div key={test.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border border-gray-200 rounded-xl hover:border-cyan-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{test.test_type}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{test.appointment_slot ? new Date(test.appointment_slot).toLocaleString() : "Not scheduled"}</span>
                      {test.payment_amount && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />₹{test.payment_amount.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(test.status, test.payment_status)}
                    {test.report_url && (
                      <a href={test.report_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200 transition">
                        <Download className="w-4 h-4" />Report
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
