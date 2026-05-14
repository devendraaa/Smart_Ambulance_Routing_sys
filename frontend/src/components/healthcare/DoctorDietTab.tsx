"use client";

import { useState, useEffect } from "react";
import { Utensils, Search, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PatientDiet {
  id: string;
  patient_email: string;
  diet_name: string;
  diet_type: string;
  calories: string;
  timing: string;
  foods: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

const DIET_TYPES = [
  "Weight Loss", "Weight Gain", "Diabetic", "Heart", "Low Salt",
  "High Protein", "Vegetarian", "Liquid Diet", "Soft Diet", "General"
];

const TIMING_OPTIONS = [
  "Morning (8 AM)", "Mid-morning (11 AM)", "Lunch (1 PM)",
  "Afternoon (4 PM)", "Dinner (8 PM)", "Bedtime"
];

export default function DoctorDietTab() {
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDiet, setNewDiet] = useState({
    patient_email: "",
    diet_name: "",
    diet_type: "General",
    calories: "",
    timing: "Lunch (1 PM)",
    foods: "",
    instructions: "",
  });

  useEffect(() => {
    loadDiets();
  }, []);

  const loadDiets = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_diets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setDiets(data || []);
    } catch (err) {
      console.error("Error loading diets:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiets = diets.filter((diet) =>
    diet.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    diet.diet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    diet.diet_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDiet = async () => {
    if (!newDiet.patient_email || !newDiet.diet_name) {
      alert("Patient email and diet name are required");
      return;
    }

    try {
      const { error } = await supabase.from("patient_diets").insert([{
        patient_email: newDiet.patient_email,
        diet_name: newDiet.diet_name,
        diet_type: newDiet.diet_type,
        calories: newDiet.calories,
        timing: newDiet.timing,
        foods: newDiet.foods,
        instructions: newDiet.instructions,
        is_active: true,
      }]);

      if (error) throw error;

      setShowAddModal(false);
      setNewDiet({
        patient_email: "",
        diet_name: "",
        diet_type: "General",
        calories: "",
        timing: "Lunch (1 PM)",
        foods: "",
        instructions: "",
      });
      loadDiets();
    } catch (err) {
      console.error("Error adding diet:", err);
      alert("Failed to add diet plan");
    }
  };

  const toggleDietStatus = async (dietId: string, currentStatus: boolean) => {
    try {
      await supabase
        .from("patient_diets")
        .update({ is_active: !currentStatus })
        .eq("id", dietId);

      setDiets(diets.map((diet) =>
        diet.id === dietId ? { ...diet, is_active: !currentStatus } : diet
      ));
    } catch (err) {
      console.error("Error updating diet:", err);
    }
  };

  const deleteDiet = async (dietId: string) => {
    if (!confirm("Are you sure you want to delete this diet plan?")) return;

    try {
      await supabase.from("patient_diets").delete().eq("id", dietId);
      setDiets(diets.filter((diet) => diet.id !== dietId));
    } catch (err) {
      console.error("Error deleting diet:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Utensils className="w-5 h-5 text-blue-600" />
          Patient Diet Plans
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by email or diet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Diet Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading diet plans...</div>
      ) : filteredDiets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No diet plans found</div>
      ) : (
        <div className="space-y-3">
          {filteredDiets.map((diet) => (
            <div key={diet.id} className={`p-4 rounded-xl border ${diet.is_active ? "bg-white border-gray-200" : "bg-gray-50 border-gray-300"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{diet.diet_name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {diet.diet_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      diet.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {diet.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Patient:</span> {diet.patient_email}
                    {diet.calories && <span className="ml-3"><span className="font-medium">Calories:</span> {diet.calories}</span>}
                    {diet.timing && <span className="ml-3"><span className="font-medium">Timing:</span> {diet.timing}</span>}
                  </p>
                  {diet.foods && (
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium">Foods:</span> {diet.foods}
                    </p>
                  )}
                  {diet.instructions && (
                    <p className="text-xs text-gray-400 mt-1">Note: {diet.instructions}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleDietStatus(diet.id, diet.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      diet.is_active
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {diet.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteDiet(diet.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Diet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Diet Plan</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Email *</label>
                  <input
                    type="email"
                    value={newDiet.patient_email}
                    onChange={(e) => setNewDiet({ ...newDiet, patient_email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diet Name *</label>
                  <input
                    type="text"
                    value={newDiet.diet_name}
                    onChange={(e) => setNewDiet({ ...newDiet, diet_name: e.target.value })}
                    placeholder="e.g., Morning Diet Plan"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diet Type</label>
                  <select
                    value={newDiet.diet_type}
                    onChange={(e) => setNewDiet({ ...newDiet, diet_type: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    {DIET_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input
                    type="text"
                    value={newDiet.calories}
                    onChange={(e) => setNewDiet({ ...newDiet, calories: e.target.value })}
                    placeholder="e.g., 2000 kcal"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timing</label>
                <select
                  value={newDiet.timing}
                  onChange={(e) => setNewDiet({ ...newDiet, timing: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                >
                  {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foods (one per line)</label>
                <textarea
                  value={newDiet.foods}
                  onChange={(e) => setNewDiet({ ...newDiet, foods: e.target.value })}
                  placeholder="Milk - 1 glass&#10;Oats - 50g&#10;Banana - 1"
                  rows={5}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={newDiet.instructions}
                  onChange={(e) => setNewDiet({ ...newDiet, instructions: e.target.value })}
                  placeholder="Any special instructions..."
                  rows={3}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleAddDiet}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Add Diet Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}