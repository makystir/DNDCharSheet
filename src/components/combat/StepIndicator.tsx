import styles from './StepIndicator.module.css';

export interface StepIndicatorProps {
  /** Step names, e.g. ['Weapon', 'Roll', 'Damage', 'Result']. */
  steps: string[];
  /** 0-indexed current step. */
  currentStep: number;
}

function getStepStatus(index: number, currentStep: number): 'completed' | 'current' | 'upcoming' {
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'current';
  return 'upcoming';
}

/**
 * Step progress bar. Ported from PWACharSheet's StepIndicator. The status is also
 * spoken: each step carries visually hidden text ("completed", "current step",
 * "upcoming") so the state is not conveyed by colour alone.
 */
export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className={styles.container} role="group" aria-label="Step progress">
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep);
        return (
          <div key={step} className={styles.step}>
            <div className={styles.bar}>
              <div className={`${styles.segment} ${styles[status]}`} />
              <div
                className={`${styles.dot} ${styles[status]}`}
                aria-current={status === 'current' ? 'step' : undefined}
              />
            </div>
            <span className={`${styles.label} ${styles[status]}`}>
              {step}
              <span className={styles.srOnly}>
                {status === 'completed' ? ' (completed)' : status === 'current' ? ' (current step)' : ' (upcoming)'}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
