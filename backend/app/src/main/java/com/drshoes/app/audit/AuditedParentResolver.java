package com.drshoes.app.audit;

import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
@Component
@Slf4j
public class AuditedParentResolver {

    private final ExpressionParser parser = new SpelExpressionParser();
    public UUID resolve(Method method, Object[] args, String expr) {
        return resolve(method, args, null, expr);
    }
    public UUID resolve(Method method, Object[] args, Object result, String expr) {
        if (expr == null || expr.isBlank()) return null;
        try {
            EvaluationContext ctx = buildContext(method, args, result);
            Object val = parser.parseExpression(expr).getValue(ctx);
            if (val == null) return null;
            if (val instanceof UUID u) return u;
            return UUID.fromString(val.toString());
        } catch (Exception e) {
            log.warn("op=auditParentEvalFailed expr={} method={} cause={}",
                     expr, method.getName(), e.getMessage());
            return null;
        }
    }

    private EvaluationContext buildContext(Method method, Object[] args, Object result) {
        SimpleEvaluationContext ctx = SimpleEvaluationContext
            .forReadOnlyDataBinding()
            .build();
        Parameter[] params = method.getParameters();
        for (int i = 0; i < params.length && i < args.length; i++) {
            ctx.setVariable(params[i].getName(), args[i]);
        }
        if (result != null) {
            ctx.setVariable("result", result);
        }
        return ctx;
    }
}
