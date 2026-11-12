import styles from './StepIndicator.module.css';

export interface StepIndicatorProps {
  /** Step names, e.g. ['Weapon', 'Roll', 'Damage', 'Result']. */
  steps: string[];
  /** 0-indexed current step. */
  currentStep: number;
  /**
   * Optional: make a step a button that jumps to it. A step is clickable only
   * when this returns true for its index (the current step never is).
   */
  canJumpTo?: (index: number) => boolean;
  onStepClick?: (index: number) => void;
}

function getStepStatus(index: number, currentStep: number): 'completed' | 'current' | 'upcoming' {
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'current';
  return 'upcoming';
}

const STATUS_TEXT = {
  completed: ' (completed)',
  current: ' (current step)',
  upcoming: ' (upcoming)',
} as const;

/**
 * Step progress bar. Ported from PWACharSheet's StepIndicator. The status is also
 * spoken: each step carries visually hidden text ("completed", "current step",
 * "upcoming") so the state is not conveyed by colour alone. When `onStepClick`
 * is given, the steps `canJumpTo` allows become buttons ("Go to Skills").
 */
export function StepIndicator({ steps, currentStep, canJumpTo, onStepClick }: StepIndicatorProps) {
  return (
    <div className={styles.container} role="group" aria-label="Step progress">
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep);
        const clickable = onStepClick !== undefined && index !== currentStep && (canJumpTo?.(index) ?? false);
        const label = (
          <>
            {step}
            <span className={styles.srOnly}>{STATUS_TEXT[status]}</span>
          </>
        );
        return (
          <div key={step} className={styles.step}>
            <div className={styles.bar}>
              <div className={`${styles.segment} ${styles[status]}`} />
              <div
                className={`${styles.dot} ${styles[status]}`}
                aria-current={status === 'current' ? 'step' : undefined}
              />
            </div>
            {clickable ? (
              <button
                type="button"
                className={`${styles.label} ${styles[status]} ${styles.labelButton}`}
                aria-label={`Go to ${step}${STATUS_TEXT[status]}`}
                onClick={() => onStepClick(index)}
              >
                {label}
              </button>
            ) : (
              <span className={`${styles.label} ${styles[status]}`}>{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
