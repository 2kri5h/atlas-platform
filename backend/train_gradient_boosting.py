import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
from pathlib import Path

MODEL_DIRECTORY = Path(__file__).resolve().parent

# 1. Load the bundled training dataset.
df = pd.read_csv(MODEL_DIRECTORY / "student_mental_health_final.csv")

features = [
    'cgpa', 
    'daily_sleep_hours', 
    'daily_study_hours', 
    'physical_activity_hours', 
    'social_support_score',
    'screen_time_hours'
]
target = 'burnout_level'

X = df[features]
y = df[target]

# 2. Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# 3. Train HistGradientBoostingClassifier
# This algorithm natively supports missing values (NaNs) without needing an Imputer!
model = HistGradientBoostingClassifier(random_state=42, max_iter=100)
model.fit(X_train, y_train)

# 4. Standard Evaluation
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)

print("=== Gradient Boosting Model Results ===")
print(f"Accuracy: {acc:.4f}\n")
print(classification_report(y_test, y_pred))

# 5. Prove that it works with missing data
print("\n--- Testing Missing Data Handling ---")
# Create a fake student where they skipped the "Social Support" question
fake_student = pd.DataFrame([{
    'cgpa': 3.5,
    'daily_sleep_hours': 4.0,  # low sleep
    'daily_study_hours': 10.0, # high study
    'physical_activity_hours': 0.0, 
    'social_support_score': np.nan, # MISSING VALUE!
    'screen_time_hours': 6.0
}])

prediction = model.predict(fake_student)
print(f"Input features:\n{fake_student}")
print(f"\nPrediction for student who skipped 'Social Support': {prediction[0]}")

# 6. Save the new model
model_path = MODEL_DIRECTORY / "website_gradient_model.pkl"
joblib.dump(model, model_path)
print(f"\nModel saved to {model_path}")
