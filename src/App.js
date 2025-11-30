import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import PageOne from './components/PageOne';
import ThanksPage from './components/ThanksPage'; 
import Constraints from './components/constraints';
import Results from './components/Results'
import Thanks2 from './components/thanks'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/page1" element={<PageOne />} />
        <Route path="/page2" element={<Constraints />} />
        <Route path="/thanks" element={<ThanksPage />} />
        <Route path="/results" element={<Results />} />
        <Route path="/thanks2" element={<Thanks2 />} />

      </Routes>
    </Router>
  );
}

export default App;
