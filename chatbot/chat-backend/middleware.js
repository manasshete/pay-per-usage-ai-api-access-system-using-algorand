import jwt from "jsonwebtoken";

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Missing Sentinal token" });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");
    
    const decoded = jwt.verify(token, secret);
    req.user = {
      userId: decoded.sub,
      walletAddress: decoded.walletAddress,
      role: decoded.role,
    };
    req.token = token;
    next();
  } catch (error) {
    console.error("JWT auth error:", error);
    return res.status(401).json({ error: "Invalid Sentinal token" });
  }
}
