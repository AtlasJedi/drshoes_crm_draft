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

/**
 * Evaluates the SpEL expression declared in {@link Audited#parent()} against
 * method arguments and returns the resulting UUID.
 *
 * Sandboxing: uses {@link SimpleEvaluationContext#forReadOnlyDataBinding()} which
 * blocks T(...) reflection escapes and Spring bean references — correct posture for
 * a cross-cutting aspect that evaluates caller-controlled expressions.
 *
 * Exception safety: any evaluation failure is caught, logged at WARN, and null is
 * returned. The audit row still writes; parent_entity_id is left null.
 *
 * Parameter binding: args are bound by parameter name using {@link Parameter#getName()}.
 * This requires the class to be compiled with {@code -parameters} (Spring Boot's Maven
 * plugin passes this flag by default via spring-boot-starter-parent). Variable names
 * follow SpEL convention: {@code #orderId}, {@code #itemId}, etc.
 */
@Component
@Slf4j
public class AuditedParentResolver {

    private final ExpressionParser parser = new SpelExpressionParser();

    /**
     * Resolves the parent UUID for an @Audited method invocation.
     *
     * @param method  the intercepted method (used for parameter name introspection)
     * @param args    the actual arguments passed to the method
     * @param expr    the SpEL expression from {@link Audited#parent()}
     * @return the UUID result, or null if expression is blank / evaluation fails
     */
    public UUID resolve(Method method, Object[] args, String expr) {
        return resolve(method, args, null, expr);
    }

    /**
     * Resolves the parent UUID for an @Audited method invocation, optionally
     * binding the return value as {@code #result} for expressions like
     * {@code #result.orderId()} or {@code #result} when the return type is UUID.
     *
     * @param method  the intercepted method (used for parameter name introspection)
     * @param args    the actual arguments passed to the method
     * @param result  the method's return value (may be null); bound as {@code #result}
     * @param expr    the SpEL expression from {@link Audited#parent()}
     * @return the UUID result, or null if expression is blank / evaluation fails
     */
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
