package com.drshoes.app.audit;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.postgresql.util.PGobject;

import java.sql.SQLException;
@Converter
public class InetAddressConverter implements AttributeConverter<String, Object> {

    @Override
    public Object convertToDatabaseColumn(String ip) {
        if (ip == null) return null;
        try {
            var obj = new PGobject();
            obj.setType("inet");
            obj.setValue(ip);
            return obj;
        } catch (SQLException e) {
            throw new IllegalArgumentException("Invalid inet address: " + ip, e);
        }
    }

    @Override
    public String convertToEntityAttribute(Object dbData) {
        if (dbData == null) return null;
        return dbData.toString();
    }
}
