<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Auth\Passwords\CanResetPassword;
use App\Notifications\ResetPasswordNotification;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, CanResetPassword;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'role',
        'password',
        'two_factor_enabled'
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_enabled' => 'boolean'
        ];
    }

    public function sendPasswordResetNotification($token)
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function otps()
    {
        return $this->hasMany(UserOtp::class);
    }

    /**
     * Get the student profile associated with the user.
     */
    public function studentProfile()
    {
        return $this->hasOne(StudentProfile::class, 'student_id');
    }

    /**
     * Get the financial data entries for the user.
     */
    public function financialData()
    {
        return $this->hasMany(FinancialData::class, 'student_id');
    }

    /**
     * Get the goals for the user.
     */
    public function goals()
    {
        return $this->hasMany(Goal::class, 'student_id');
    }

    /** 
     * Get the budgets for the user.
     */
    public function budgets()
    {
        return $this->hasMany(Budget::class, 'student_id');
    }
}
