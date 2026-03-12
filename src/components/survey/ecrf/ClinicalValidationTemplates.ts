// Clinical validation template presets for eCRF questions
export interface ClinicalValidationTemplate {
  id: string;
  label: string;
  labelPt: string;
  unit: string;
  min: number;
  max: number;
  type: "number";
}

export const clinicalValidationTemplates: ClinicalValidationTemplate[] = [
  { id: "systolic_bp", label: "Systolic Blood Pressure", labelPt: "PA Sistólica", unit: "mmHg", min: 40, max: 300, type: "number" },
  { id: "diastolic_bp", label: "Diastolic Blood Pressure", labelPt: "PA Diastólica", unit: "mmHg", min: 20, max: 200, type: "number" },
  { id: "heart_rate", label: "Heart Rate", labelPt: "Frequência Cardíaca", unit: "bpm", min: 20, max: 250, type: "number" },
  { id: "fasting_glucose", label: "Fasting Glucose", labelPt: "Glicemia de Jejum", unit: "mg/dL", min: 10, max: 1000, type: "number" },
  { id: "hba1c", label: "HbA1c", labelPt: "HbA1c", unit: "%", min: 2, max: 20, type: "number" },
  { id: "weight", label: "Weight", labelPt: "Peso", unit: "kg", min: 0.5, max: 500, type: "number" },
  { id: "height", label: "Height", labelPt: "Altura", unit: "cm", min: 20, max: 300, type: "number" },
  { id: "bmi", label: "BMI", labelPt: "IMC", unit: "kg/m²", min: 5, max: 100, type: "number" },
  { id: "temperature", label: "Temperature", labelPt: "Temperatura", unit: "°C", min: 30, max: 45, type: "number" },
  { id: "spo2", label: "SpO2", labelPt: "SpO2", unit: "%", min: 50, max: 100, type: "number" },
  { id: "respiratory_rate", label: "Respiratory Rate", labelPt: "Frequência Respiratória", unit: "irpm", min: 4, max: 60, type: "number" },
  { id: "total_cholesterol", label: "Total Cholesterol", labelPt: "Colesterol Total", unit: "mg/dL", min: 50, max: 600, type: "number" },
  { id: "ldl", label: "LDL Cholesterol", labelPt: "LDL", unit: "mg/dL", min: 10, max: 500, type: "number" },
  { id: "hdl", label: "HDL Cholesterol", labelPt: "HDL", unit: "mg/dL", min: 5, max: 200, type: "number" },
  { id: "triglycerides", label: "Triglycerides", labelPt: "Triglicerídeos", unit: "mg/dL", min: 10, max: 2000, type: "number" },
  { id: "creatinine", label: "Creatinine", labelPt: "Creatinina", unit: "mg/dL", min: 0.1, max: 30, type: "number" },
  { id: "hemoglobin", label: "Hemoglobin", labelPt: "Hemoglobina", unit: "g/dL", min: 2, max: 25, type: "number" },
  { id: "age", label: "Age", labelPt: "Idade", unit: "anos", min: 0, max: 150, type: "number" },
];
