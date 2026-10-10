import '@testing-library/jest-dom'

// jsdom lacks these; Radix Select needs them
Element.prototype.hasPointerCapture = () => false;
Element.prototype.scrollIntoView = () => {};
