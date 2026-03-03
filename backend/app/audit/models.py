from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    """NIS2-compliant audit trail for all operations"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)       # CREATE, UPDATE, DELETE, VIEW, LOGIN, etc.
    resource_type = Column(String(100), nullable=False) # supplier, contract, vendor_rating, etc.
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)               # Before/after state
    ip_address = Column(String(45), nullable=True)      # IPv4/IPv6
    user_agent = Column(String(512), nullable=True)
    status = Column(String(20), default="success")      # success, failure, error
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="audit_logs")
