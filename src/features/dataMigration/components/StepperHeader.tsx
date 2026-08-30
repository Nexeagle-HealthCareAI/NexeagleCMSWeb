import React from 'react';

export type WizardStep = 'upload' | 'detect' | 'transform' | 'preview';

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'detect', label: 'Detect' },
    { key: 'transform', label: 'Transform' },
    { key: 'preview', label: 'Preview' },
];

const StepperHeader: React.FC<{ current: WizardStep }> = ({ current }) => {
    const currentIndex = STEPS.findIndex((s) => s.key === current);

    return (
        <div className="dm-stepper">
            {STEPS.map((step, i) => (
                <React.Fragment key={step.key}>
                    <div className={`dm-stepper-step ${i === currentIndex ? 'active' : i < currentIndex ? 'complete' : ''}`}>
                        <span className="dm-stepper-dot">{i < currentIndex ? '✓' : i + 1}</span>
                        <span>{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="dm-stepper-line" />}
                </React.Fragment>
            ))}
        </div>
    );
};

export default StepperHeader;
