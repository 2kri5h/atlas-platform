# Burnout Risk Model Rationale

## Why We Synthesized the Burnout Label
For our machine learning model, we utilized a real-world dataset of 150,000 students sourced from GitHub. This provided us with highly realistic distributions for behavioral features like CGPA, daily sleep hours, physical activity, and screen time. 

However, we found that the original burnout level represented in the dataset was **not matching with real-world research** and the actual science behind student burnout. To train a model that actually provides valuable insights, we retained the real-world feature data but synthesized a new, scientifically accurate target variable (`burnout_level`) using the heuristic formula below.

## The Science of Student Burnout
Studies from sources like *Frontiers in Psychology* and the *National Institutes of Health (NIH)* show a consistent hierarchy in what causes (and prevents) student burnout:

1. **Academic Stress / Pressure (The Primary Driver)**: This is universally cited as the #1 predictor. Heavy workload (Study Hours) and high pressure directly cause emotional exhaustion.
2. **Sleep Quality & Duration (The Foundation)**: Sleep is the most critical physical factor. Poor sleep accelerates burnout, while good sleep acts as a powerful "buffer" that protects the brain against stress.
3. **Social Support (The Shield)**: Having a strong social support network is cited as the best defense mechanism. It drastically lowers the risk of cynicism (a core component of burnout).
4. **Anxiety & Depression (The Multipliers)**: These are closely linked to stress. They create a "vicious cycle" where burnout causes depression, and depression worsens burnout.
5. **Physical Activity & Screen Time (Secondary Factors)**: Exercise is a proven stress-reliever, while excessive screen time (especially social media) is linked to higher emotional exhaustion, but they are not as powerful as Sleep or direct Academic Stress.

## The Heuristic Formula
Based on this real-world research, here is how we set the "multiply score" (weights) for the 6 features used on our platform. 

Notice how **Study Hours (Stress)** and **Sleep** have the highest multipliers because science dictates they are the most important factors:

```text
Burnout Risk Score = 
  (daily_study_hours * 2.0)         <-- #1 Driver (High Workload = High Stress)
+ (screen_time_hours * 0.8)         <-- Secondary stressor
- (daily_sleep_hours * 2.0)         <-- #1 Protector (The Foundation)
- (social_support_score * 1.5)      <-- Strong Buffer (The Shield)
- (physical_activity_hours * 1.0)   <-- Secondary stress-reliever
- (cgpa * 0.5)                      <-- Slight buffer (Doing well academically reduces panic)
+ (Random Noise between -2 and +2)
```

The resulting `Burnout Risk Score` was then categorized into **Low**, **Medium**, and **High** risk levels to create the final labels used to train the Gradient Boosting model.
