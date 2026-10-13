from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
from datetime import datetime
import traceback

app = Flask(__name__)
CORS(app)

# ============================================
# INVESTMENT SIMULATOR CLASS & HELPER FUNCTIONS
# ============================================
# These must be defined BEFORE loading the pickle file

def calculate_compound_growth(principal, annual_rate, duration_months, monthly_contribution=0, 
                              compounding_frequency='monthly'):
    """
    Calculate compound interest growth with regular contributions
    
    Parameters:
    - principal: Initial investment amount
    - annual_rate: Annual interest rate (as percentage, e.g., 12.5)
    - duration_months: Investment duration in months
    - monthly_contribution: Regular monthly contribution
    - compounding_frequency: How often interest compounds ('monthly', 'quarterly', 'annually')
    
    Returns:
    - Dictionary with final value, growth, and monthly breakdown
    """
    
    # Convert annual rate to decimal
    rate = annual_rate / 100
    
    # Determine compounding periods per year
    if compounding_frequency == 'monthly':
        n = 12
    elif compounding_frequency == 'quarterly':
        n = 4
    elif compounding_frequency == 'annually':
        n = 1
    else:
        n = 12  # Default to monthly
    
    # Calculate period rate
    period_rate = rate / n
    
    # Initialize tracking
    current_value = principal
    monthly_breakdown = []
    total_contributions = principal
    
    # Calculate growth month by month
    for month in range(1, duration_months + 1):
        # Add monthly contribution
        if month > 1:  # Don't add contribution in first month (already in principal)
            current_value += monthly_contribution
            total_contributions += monthly_contribution
        
        # Apply interest (compounded based on frequency)
        periods_in_month = n / 12
        current_value = current_value * (1 + period_rate) ** periods_in_month
        
        # Track monthly progress
        monthly_breakdown.append({
            'month': month,
            'value': round(current_value, 2),
            'contributions_to_date': round(total_contributions, 2),
            'growth': round(current_value - total_contributions, 2)
        })
    
    final_value = current_value
    total_growth = final_value - total_contributions
    percentage_growth = (total_growth / total_contributions) * 100
    
    return {
        'final_value': round(final_value, 2),
        'total_invested': round(total_contributions, 2),
        'total_growth': round(total_growth, 2),
        'percentage_return': round(percentage_growth, 2),
        'monthly_breakdown': monthly_breakdown
    }


def monte_carlo_simulation(principal, annual_rate, volatility, duration_months, 
                          monthly_contribution=0, num_simulations=1000):
    """
    Run Monte Carlo simulation to project investment outcomes with market volatility
    
    Parameters:
    - principal: Initial investment
    - annual_rate: Expected annual return (%)
    - volatility: Annual volatility/standard deviation (%)
    - duration_months: Investment period in months
    - monthly_contribution: Regular monthly addition
    - num_simulations: Number of scenarios to simulate
    
    Returns:
    - Dictionary with best/worst/median cases and confidence intervals
    """
    
    # Convert rates to decimal and monthly
    monthly_rate = (annual_rate / 100) / 12
    monthly_volatility = (volatility / 100) / np.sqrt(12)
    
    # Store final values from all simulations
    final_values = []
    
    for _ in range(num_simulations):
        current_value = principal
        total_invested = principal
        
        # Simulate month by month
        for month in range(1, duration_months + 1):
            # Add monthly contribution
            if month > 1:
                current_value += monthly_contribution
                total_invested += monthly_contribution
            
            # Generate random return for this month (normal distribution)
            monthly_return = np.random.normal(monthly_rate, monthly_volatility)
            current_value = current_value * (1 + monthly_return)
        
        final_values.append(current_value)
    
    # Calculate statistics from simulations
    final_values = np.array(final_values)
    
    return {
        'best_case': round(np.percentile(final_values, 95), 2),  # 95th percentile
        'worst_case': round(np.percentile(final_values, 5), 2),  # 5th percentile
        'median_case': round(np.median(final_values), 2),
        'mean_case': round(np.mean(final_values), 2),
        'confidence_95_lower': round(np.percentile(final_values, 2.5), 2),
        'confidence_95_upper': round(np.percentile(final_values, 97.5), 2),
        'standard_deviation': round(np.std(final_values), 2)
    }


def calculate_time_to_goal(current_amount, target_amount, annual_rate, monthly_contribution=0):
    """
    Calculate months needed to reach a target amount
    
    Parameters:
    - current_amount: Starting investment
    - target_amount: Goal amount
    - annual_rate: Expected annual return (%)
    - monthly_contribution: Regular monthly addition
    
    Returns:
    - Dictionary with months needed and breakdown
    """
    
    if current_amount >= target_amount:
        return {
            'months_needed': 0,
            'already_achieved': True,
            'message': 'Target already achieved!'
        }
    
    monthly_rate = (annual_rate / 100) / 12
    current_value = current_amount
    months = 0
    max_months = 600  # 50 years max
    
    while current_value < target_amount and months < max_months:
        months += 1
        current_value += monthly_contribution
        current_value = current_value * (1 + monthly_rate)
    
    if months >= max_months:
        return {
            'months_needed': None,
            'achievable': False,
            'message': 'Target not achievable with current parameters within 50 years'
        }
    
    years = months // 12
    remaining_months = months % 12
    
    return {
        'months_needed': months,
        'years': years,
        'remaining_months': remaining_months,
        'achievable': True,
        'message': f'Target achievable in {years} years and {remaining_months} months'
    }


class InvestmentSimulator:
    """
    Complete investment simulation engine for PennyWise
    """
    
    def __init__(self, investment_statistics):
        self.stats = investment_statistics
        
    def simulate(self, amount_invested, duration_value, duration_unit='months',
                 investment_type='mmf', monthly_topup=0, target_amount=None,
                 reinvestment_frequency='monthly'):
        """
        Run complete investment simulation
        
        Parameters:
        - amount_invested: Initial investment amount (KES)
        - duration_value: Duration number
        - duration_unit: 'months' or 'years'
        - investment_type: 'mmf', 'tbill', 'stock', or 'bond'
        - monthly_topup: Regular monthly contribution
        - target_amount: Optional goal amount
        - reinvestment_frequency: How often to compound
        
        Returns:
        - Complete simulation results in JSON format
        """
        
        # Convert duration to months
        if duration_unit == 'years':
            duration_months = duration_value * 12
        else:
            duration_months = duration_value
        
        # Get statistics for investment type
        inv_stats = self.stats[investment_type]
        annual_return = inv_stats['average_annual_return']
        volatility = inv_stats['average_volatility']
        risk_level = inv_stats['risk_level']
        
        # Calculate base projection (deterministic)
        base_projection = calculate_compound_growth(
            principal=amount_invested,
            annual_rate=annual_return,
            duration_months=duration_months,
            monthly_contribution=monthly_topup,
            compounding_frequency=reinvestment_frequency
        )
        
        # Run Monte Carlo for risk analysis
        mc_results = monte_carlo_simulation(
            principal=amount_invested,
            annual_rate=annual_return,
            volatility=volatility,
            duration_months=duration_months,
            monthly_contribution=monthly_topup,
            num_simulations=1000
        )
        
        # Calculate annualized return
        total_years = duration_months / 12
        annualized_return = ((base_projection['final_value'] / base_projection['total_invested']) 
                           ** (1 / total_years) - 1) * 100
        
        # Calculate target goal if provided
        goal_analysis = None
        if target_amount and target_amount > amount_invested:
            goal_analysis = calculate_time_to_goal(
                current_amount=amount_invested,
                target_amount=target_amount,
                annual_rate=annual_return,
                monthly_contribution=monthly_topup
            )
        
        # Build result JSON
        result = {
            'simulation_id': f"SIM_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'timestamp': datetime.now().isoformat(),
            
            'investment_details': {
                'investment_type': investment_type,
                'amount_invested': amount_invested,
                'duration_value': duration_value,
                'duration_unit': duration_unit,
                'duration_months': duration_months,
                'monthly_topup': monthly_topup,
                'reinvestment_frequency': reinvestment_frequency,
                'target_amount': target_amount
            },
            
            'projections': {
                'projected_final_value': base_projection['final_value'],
                'total_invested': base_projection['total_invested'],
                'total_growth': base_projection['total_growth'],
                'percentage_return': base_projection['percentage_return'],
                'annualized_return': round(annualized_return, 2)
            },
            
            'risk_analysis': {
                'risk_level': risk_level,
                'volatility': volatility,
                'best_case_scenario': mc_results['best_case'],
                'worst_case_scenario': mc_results['worst_case'],
                'median_scenario': mc_results['median_case'],
                'confidence_95_lower': mc_results['confidence_95_lower'],
                'confidence_95_upper': mc_results['confidence_95_upper']
            },
            
            'timeline': base_projection['monthly_breakdown'],
            
            'goal_analysis': goal_analysis,
            
            'model_parameters': {
                'average_annual_return': annual_return,
                'historical_volatility': volatility,
                'data_period': self.stats['metadata']['data_period'],
                'calculation_method': 'monte_carlo_with_compound_interest',
                'tax_rate': self.stats['metadata']['tax_rate'],
                'currency': self.stats['metadata']['currency']
            }
        }
        
        return result


# ============================================
# LOAD MODELS
# ============================================

# Load the investment simulator
import __main__
__main__.InvestmentSimulator = InvestmentSimulator  
try:
    with open('investment_simulator.pkl', 'rb') as f:
        investment_package = pickle.load(f)
        investment_simulator = investment_package['simulator']
        investment_statistics = investment_package['investment_statistics']
    print("Investment simulator loaded")
    print(f"   Supported types: {investment_package['supported_types']}")
except Exception as e:
    print(f"Error loading investment simulator: {e}")
    print(f"   Traceback: {traceback.format_exc()}")
    investment_simulator = None
    investment_statistics = None

# ============================================
# UTILITY FUNCTIONS
# ============================================

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


# ============================================
# INVESTMENT SIMULATION ENDPOINTS
# ============================================

@app.route('/api/investment/simulate', methods=['POST'])
def simulate_investment():
    """
    Investment simulation endpoint
    
    Expected JSON body:
    {
        "amount_invested": 10000,
        "duration_value": 12,
        "duration_unit": "months",
        "investment_type": "mmf",
        "monthly_topup": 500,
        "target_amount": 50000,
        "reinvestment_frequency": "monthly"
    }
    """
    try:
        if investment_simulator is None:
            return jsonify({
                'status': 'error',
                'message': 'Investment simulator not loaded'
            }), 500
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        # Validate required fields
        required_fields = ['amount_invested', 'duration_value', 'investment_type']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Validate investment type
        valid_types = ['mmf', 'tbill', 'stock', 'bond']
        investment_type = data['investment_type'].lower()
        
        if investment_type not in valid_types:
            return jsonify({
                'status': 'error',
                'message': f'Invalid investment type. Must be one of: {", ".join(valid_types)}'
            }), 400
        
        # Extract and validate parameters
        amount_invested = safe_float(data['amount_invested'])
        duration_value = safe_int(data['duration_value'])
        duration_unit = safe_string(data.get('duration_unit', 'months'), 'months')
        monthly_topup = safe_float(data.get('monthly_topup', 0))
        target_amount = safe_float(data.get('target_amount')) if data.get('target_amount') else None
        reinvestment_frequency = safe_string(data.get('reinvestment_frequency', 'monthly'), 'monthly')
        
        # Validation
        if amount_invested <= 0:
            return jsonify({
                'status': 'error',
                'message': 'Amount invested must be greater than 0'
            }), 400
        
        if duration_value <= 0:
            return jsonify({
                'status': 'error',
                'message': 'Duration must be greater than 0'
            }), 400
        
        if duration_unit not in ['months', 'years']:
            return jsonify({
                'status': 'error',
                'message': 'Duration unit must be "months" or "years"'
            }), 400
        
        if monthly_topup < 0:
            return jsonify({
                'status': 'error',
                'message': 'Monthly top-up cannot be negative'
            }), 400
        
        if target_amount and target_amount < amount_invested:
            return jsonify({
                'status': 'error',
                'message': 'Target amount must be greater than initial investment'
            }), 400
        
        # Run simulation
        result = investment_simulator.simulate(
            amount_invested=amount_invested,
            duration_value=duration_value,
            duration_unit=duration_unit,
            investment_type=investment_type,
            monthly_topup=monthly_topup,
            target_amount=target_amount,
            reinvestment_frequency=reinvestment_frequency
        )
        
        print(f"[Investment Simulation] Type: {investment_type}, Amount: {amount_invested}, Duration: {duration_value} {duration_unit}")
        
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
        
    except Exception as e:
        error_trace = traceback.format_exc()
        print("ERROR in investment simulation:", error_trace)
        
        return jsonify({
            'status': 'error',
            'message': str(e),
            'trace': error_trace
        }), 500

@app.route('/api/investment/statistics', methods=['GET'])
def get_investment_statistics():
    """Get investment statistics for all types"""
    try:
        if investment_statistics is None:
            return jsonify({
                'status': 'error',
                'message': 'Investment statistics not loaded'
            }), 500
        
        # Format statistics for frontend
        formatted_stats = {
            'investment_types': []
        }
        
        type_names = {
            'mmf': 'Money Market Fund',
            'tbill': 'Treasury Bill',
            'stock': 'Stock Market',
            'bond': 'Government Bond'
        }
        
        type_descriptions = {
            'mmf': 'Low-risk savings with competitive returns. Ideal for emergency funds and short-term goals.',
            'tbill': 'Government-backed securities with guaranteed returns. Perfect for risk-averse investors.',
            'stock': 'Higher potential returns with market risk. Best for long-term wealth building.',
            'bond': 'Stable government securities with predictable income. Good for medium-term goals.'
        }
        
        recommended_durations = {
            'mmf': '3-12 months',
            'tbill': '3-12 months',
            'stock': '2+ years',
            'bond': '1-5 years'
        }
        
        for inv_type in ['mmf', 'tbill', 'stock', 'bond']:
            stats = investment_statistics[inv_type]
            
            formatted_stats['investment_types'].append({
                'type': inv_type,
                'name': type_names[inv_type],
                'description': type_descriptions[inv_type],
                'average_return': round(stats['average_annual_return'], 2),
                'risk_level': stats['risk_level'],
                'volatility': round(stats['average_volatility'], 2),
                'min_expected_return': round(stats['min_return'], 2),
                'max_expected_return': round(stats['max_return'], 2),
                'recommended_duration': recommended_durations[inv_type]
            })
        
        formatted_stats['metadata'] = investment_statistics['metadata']
        
        return jsonify({
            'status': 'success',
            'data': formatted_stats
        }), 200
        
    except Exception as e:
        error_trace = traceback.format_exc()
        print("ERROR:", error_trace)
        
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    """General health check"""
    return jsonify({
        'status': 'healthy',
        'models': {
            'investment_simulator': investment_simulator is not None
        },
        'version': '2.0.0'
    })

@app.route('/api/health', methods=['GET'])
def api_health_check():
    """API-specific health check"""
    return jsonify({
        'status': 'healthy',
        'services': {
            'investment_simulation': investment_simulator is not None
        },
        'endpoints': {
            'investment_simulate': '/api/investment/simulate',
            'investment_stats': '/api/investment/statistics'
        }
    })

# ============================================
# RUN APPLICATION
# ============================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print(" PennyWise Finance API Starting...")
    print("="*60)
    print(f"Investment Simulator: {' Loaded' if investment_simulator else 'Not Loaded'}")
    print("="*60)
    print("Available Endpoints:")
    print("  - POST /api/investment/simulate (Investment simulation)")
    print("  - GET  /api/investment/statistics (Investment stats)")
    print("  - GET  /health (Health check)")
    print("="*60 + "\n")
    
    app.run(host='127.0.0.1', port=5000, debug=False)