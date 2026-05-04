import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const OAuthAuthorize = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("oauth", "true");
    navigate(`/auth?${next.toString()}`, { replace: true });
  }, [params, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default OAuthAuthorize;
