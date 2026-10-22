// Test-only isolated field journey. No authentication bypass or production API.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Practice from '../../apps/web/app/practice-workspace';
createRoot(document.getElementById('root')!).render(<Practice/>);
