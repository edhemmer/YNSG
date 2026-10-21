// Test-only full shell. No production route, auth bypass or real provider.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../apps/web/app/workspace';
createRoot(document.getElementById('root')!).render(<Workspace configured/>);
