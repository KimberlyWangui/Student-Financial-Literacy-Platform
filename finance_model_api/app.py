from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np

app = Flask(__name__)
CORS(app)

# Load the trained model
model = joblib.load("finance_behavior_classifier_v3_scaled.pkl")

def safe_float(value, default=0.0):
    """Safely convert value to float"""
    try:
        if value is None or value == '':
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    """Safely convert value to int"""
    try:
        if value is None or value == '':
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_string(value, default=''):
    """Safely convert value to string"""
    try:
        if value is None:
            return default
        return str(value).strip()
    except:
        return default

def generate_recommendation(data, predicted_label, confidence):
    """
    Generate recommendation based on prediction
    """
    monthly_income = safe_float(data.get('monthly_income', 0))
    total_expenses = safe_float(data.get('total_expenses', 0))
    savings = monthly_income - total_expenses
    
    top_cat = safe_string(data.get('top_spending_category', 'expenses'))
    top_amount = safe_float(data.get('top_category_amount', 0))
    
    if predicted_label == 'overspending':
        impact = round(0.10 * top_amount, 2)
        title = f"Reduce {top_cat} spending"
        text = f"You're spending {total_expenses:,.0f} KES against income of {monthly_income:,.0f} KES. Consider reducing {top_cat} by 10% to save {impact:,.0f} KES/month."
        reasoning = f"Expense-to-income ratio: {(total_expenses/monthly_income if monthly_income > 0 else 0)*100:.0f}%. Top category: {top_cat}."
        
    elif predicted_label == 'under_saving':
        target_save = round(0.10 * monthly_income, 2)
        impact = target_save
        title = "Boost your savings rate"
        text = f"You're currently saving {savings:,.0f} KES/month. Try to save at least 10% ({target_save:,.0f} KES) by cutting discretionary spending."
        reasoning = f"Current savings rate: {(savings/monthly_income if monthly_income > 0 else 0)*100:.1f}%. Recommended: 10-20%."
        
    elif predicted_label == 'saving_well':
        additional = round(0.05 * monthly_income, 2)
        impact = additional
        title = "Excellent savings! Consider investing"
        text = f"You're saving {savings:,.0f} KES/month ({(savings/monthly_income if monthly_income > 0 else 0)*100:.0f}%). Consider investing {additional:,.0f} KES extra."
        reasoning = f"Strong savings rate detected. Current rate: {(savings/monthly_income if monthly_income > 0 else 0)*100:.0f}%."
        
    else:  # balanced
        impact = 0.0
        title = "Maintain your balanced approach"
        text = f"Your finances are balanced. Keep tracking expenses and review spending patterns monthly."
        reasoning = f"Expense-to-income ratio: {(total_expenses/monthly_income if monthly_income > 0 else 0)*100:.0f}%. Savings: {savings:,.0f} KES/month."
    
    return {
        'title': title,
        'recomm_text': text,
        'category': 'Behavioral',
        'confidence_score': round(float(confidence), 2),
        'reasoning': reasoning,
        'impact_estimate': float(impact),
        'source_type': 'AI_Model',
        'model_version': 'rf-synthetic-v2'
    }

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        # Required fields
        required_fields = [
            'student_id', 'monthly_income', 'age',
            'housing_burden', 'education_burden', 'essential_ratio',
            'spending_concentration', 'tuition_monthly_share',
            'housing_share', 'food_share', 'transportation_share',
            'books_supplies_share', 'entertainment_share',
            'personal_care_share', 'technology_share',
            'health_wellness_share', 'miscellaneous_share',
            'discretionary_ratio', 'gender', 'year_in_school',
            'preferred_payment_method', 'major', 'top_spending_category'
        ]
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        student_id = safe_int(data['student_id'])
        
        # Prepare features for model
        feature_data = {
            # Numerical features
            'monthly_income': safe_float(data['monthly_income']),
            'age': safe_int(data['age']),
            'housing_burden': safe_float(data['housing_burden']),
            'education_burden': safe_float(data['education_burden']),
            'essential_ratio': safe_float(data['essential_ratio']),
            'spending_concentration': safe_float(data['spending_concentration']),
            'tuition_monthly_share': safe_float(data['tuition_monthly_share']),
            'housing_share': safe_float(data['housing_share']),
            'food_share': safe_float(data['food_share']),
            'transportation_share': safe_float(data['transportation_share']),
            'books_supplies_share': safe_float(data['books_supplies_share']),
            'entertainment_share': safe_float(data['entertainment_share']),
            'personal_care_share': safe_float(data['personal_care_share']),
            'technology_share': safe_float(data['technology_share']),
            'health_wellness_share': safe_float(data['health_wellness_share']),
            'miscellaneous_share': safe_float(data['miscellaneous_share']),
            'discretionary_ratio': safe_float(data['discretionary_ratio']),
            # Categorical features as STRINGS
            'gender': safe_string(data['gender'], 'other'),
            'year_in_school': safe_string(data['year_in_school'], 'one'),
            'preferred_payment_method': safe_string(data['preferred_payment_method'], 'Cash'),
            'major': safe_string(data['major'], 'Undeclared'),
            'top_spending_category': safe_string(data['top_spending_category'], 'miscellaneous'),
        }
        
        # Create DataFrame
        df = pd.DataFrame([feature_data])
        
        # Ensure numeric columns are float64
        numeric_cols = [
            'monthly_income', 'age', 'housing_burden', 'education_burden',
            'essential_ratio', 'spending_concentration', 'tuition_monthly_share',
            'housing_share', 'food_share', 'transportation_share',
            'books_supplies_share', 'entertainment_share', 'personal_care_share',
            'technology_share', 'health_wellness_share', 'miscellaneous_share',
            'discretionary_ratio'
        ]
        
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0).astype('float64')
        
        # Ensure categorical columns are strings
        categorical_cols = ['gender', 'year_in_school', 'preferred_payment_method', 
                           'major', 'top_spending_category']
        for col in categorical_cols:
            df[col] = df[col].astype(str)
        
        # Predict
        prediction = model.predict(df)[0]
        probabilities = model.predict_proba(df)[0]
        confidence = float(probabilities.max())
        
        print(f"[Student {student_id}] Prediction: {prediction}, Confidence: {confidence:.3f}")
        
        # Generate recommendation
        recommendation = generate_recommendation(data, prediction, confidence)
        
        return jsonify({
            'status': 'success',
            'student_id': student_id,
            'predicted_label': prediction,
            'confidence': round(confidence, 3),
            'recommendation': recommendation
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print("ERROR:", error_trace)
        
        return jsonify({
            'status': 'error',
            'message': str(e),
            'trace': error_trace
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_version': 'rf-synthetic-v2'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)