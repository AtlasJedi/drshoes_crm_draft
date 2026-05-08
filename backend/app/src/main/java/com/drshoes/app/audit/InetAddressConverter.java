package com.drshoes.app.audit;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.postgresql.util.PGobject;

import java.sql.SQLException;

/**
 * JPA AttributeConverter: maps a Java String to a PostgreSQL inet column.
 *
 * The PostgreSQL JDBC driver requires inet values to be passed as PGobject with
 * type "inet". Without this converter, Hibernate 6 binds the value as VARCHAR
 * and Postgres rejects it: "column is of type inet but expression is of type
 * character varying".
 *
 * postgresql driver promoted to compile scope in pom.xml to allow this import.
 */
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
