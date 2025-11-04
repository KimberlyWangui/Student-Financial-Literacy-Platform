from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# Load the trained model
model = joblib.load("finance_rf_model.pkl")

def generate_recommendation(data, predicted_label, confidence):
    """
    Generate recommendation text based on prediction and input data
    """
    # Convert all numeric values to proper types
    top_cat = str(data.get('top_spending_category', 'a category'))
    budget_total = float(data.get('budget_total', 0))
    actual = float(data.get('actual_spent_total', 0))
    avg_goal_progress = float(data.get('avg_goal_progress', 0))
    total_amount_90 = float(data.get('total_amount_90', 0))
    top_amount = float(data.get('top_category_amount', 0))
    total_target = float(data.get('total_target', 1000))
    
    if predicted_label == 'overspending':
        title = f"Reduce spending on {top_cat}"
        impact = round(0.10 * top_amount, 2)
        text = f"You are overspending (actual {actual:.2f} vs budget {budget_total:.2f}). Try reducing {top_cat} by 10% next month — estimated saving {impact:.2f} KES."
        reasoning = f"Top spending: {top_cat} ({top_amount:.2f} KES). Actual vs budget: {actual:.2f}/{budget_total:.2f}."
    elif predicted_label == 'under_saving':
        title = "Increase automated savings"
        avg_month = total_amount_90 / 3 if total_amount_90 > 0 else 0
        impact = round(0.05 * avg_month, 2)
        text = f"You're behind on savings. Consider automating {impact:.2f} KES/month to your savings goal."
        reasoning = f"Avg monthly income ~{avg_month:.2f} KES; savings progress {avg_goal_progress:.2f}."
    elif predicted_label == 'saving_well':
        title = "Great progress — consider boosting goal"
        impact = round(0.05 * total_target, 2)
        text = f"You're doing well. Consider adding {impact:.2f} KES monthly or raising your goal to accelerate savings."
        reasoning = f"Savings progress {avg_goal_progress:.2f}; maintaining good budget discipline."
    else:  # balanced
        title = "Maintain good habits"
        text = "Your financial habits are balanced. Keep tracking expenses and review budgets weekly."
        reasoning = f"Budget efficiency: {(actual/(budget_total+1)):.2f}; goal progress: {avg_goal_progress:.2f}."
        impact = 0.0
    
    return {
        'title': title,
        'recomm_text': text,
        'category': 'Behavioral',
        'confidence_score': round(confidence, 2),
        'reasoning': reasoning,
        'impact_estimate': float(impact),
        'source_type': 'AI_Model',
        'model_version': 'rf-v1'
    }

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['student_id', 'total_amount_30', 'txn_count_30', 'avg_amount_30', 
                          'total_amount_90', 'budgets_count', 'budget_total', 'actual_spent_total',
                          'goals_count', 'avg_goal_progress', 'top_category_amount',
                          'monthly_allowance_range', 'living_situation']
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract student_id before creating DataFrame
        student_id = data['student_id']
        
        # Create DataFrame (excluding student_id from features)
        feature_data = {k: v for k, v in data.items() if k != 'student_id'}
        df = pd.DataFrame([feature_data])
        
        # One-hot encode categorical columns
        df = pd.get_dummies(df, columns=['monthly_allowance_range', 'living_situation'])
        
        # Align with model's expected columns (fill missing ones with 0)
        model_features = model.feature_names_in_
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        df = df[model_features]
        
        # Predict
        prediction = model.predict(df)[0]
        probabilities = model.predict_proba(df)[0]
        confidence = float(probabilities.max())
        
        # Generate recommendation
        recommendation = generate_recommendation(data, prediction, confidence)
        
        # Return complete recommendation data for Laravel to store
        return jsonify({
            'status': 'success',
            'student_id': student_id,
            'predicted_label': prediction,
            'confidence': round(confidence, 3),
            'recommendation': recommendation
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_version': 'rf-v1'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)