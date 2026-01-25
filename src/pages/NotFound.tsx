import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Handle incorrectly encoded URLs like /%3Ftab=settings (encoded ?tab=settings)
    const path = location.pathname;
    
    // Check if path contains URL-encoded query string
    if (path.includes('%3F') || path.includes('%3f')) {
      const decodedPath = decodeURIComponent(path);
      // Extract query string from decoded path
      const questionMarkIndex = decodedPath.indexOf('?');
      if (questionMarkIndex !== -1) {
        const queryString = decodedPath.substring(questionMarkIndex);
        navigate('/' + queryString, { replace: true });
        return;
      }
    }

    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Página não encontrada</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          Voltar para o início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
